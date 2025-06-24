import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import pool, { Video } from "../models";
import { StorageService } from "../services/storage.service";
import { FFmpegService } from "../services/ffmpeg.service";

const upload = multer({ storage: multer.memoryStorage() });

export class VideoController {
  static uploadVideo = [
    upload.single("video"),
    (async (req, res) => {
      if (!req.file) {
        res.status(400).json({ message: "No video file provided" });
        return;
      }

      const userId = req.user!.id;

      // 1. Get user's channel ID
      const channelRes = await pool.query(
        `SELECT id FROM channels WHERE user_id = $1`,
        [userId]
      );

      if (channelRes.rows.length === 0) {
        res.status(400).json({ message: "User does not have a channel" });
        return;
      }
      const channelId = channelRes.rows[0].id;

      // Upload original video
      const fileKey = await StorageService.uploadFile(req.file);

      // 2. Insert video with channel_id and category_id
      const { title, description, categoryId } = req.body;
      const result = await pool.query<Video>(
        `INSERT INTO videos (channel_id, category_id, title, description, original_filename, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          channelId,
          categoryId || null,
          title,
          description,
          fileKey,
          "uploading",
        ]
      );
      const video = result.rows[0];

      // Background processing
      setImmediate(async () => {
        let tempDir = "";
        let hlsPath = "";

        try {
          tempDir = path.join(
            process.cwd(),
            "temp",
            channelId.toString(), // Use channelId instead of userId
            video.id.toString()
          );
          fs.mkdirSync(tempDir, { recursive: true });

          const tempPath = path.join(tempDir, req.file!.originalname);
          fs.writeFileSync(tempPath, req.file!.buffer);

          // Pass channelId to FFmpegService
          const {
            hlsPath: processedPath,
            thumbnailPath,
            duration,
          } = await FFmpegService.processVideo(
            tempPath,
            channelId.toString(), // Pass channelId instead of userId
            video.id.toString()
          );

          hlsPath = processedPath;
          console.log(`Processing completed for video ${video.id}`);

          // Use channelId in storage path
          const processedFolder = `processed/${channelId}/${video.id}`;

          // Upload HLS files
          if (fs.existsSync(hlsPath)) {
            const files = fs.readdirSync(hlsPath);
            for (const file of files) {
              const filePath = path.join(hlsPath, file);
              if (fs.statSync(filePath).isFile()) {
                const s3Key = `${processedFolder}/${file}`;
                console.log(`Uploading ${file} to ${s3Key}`);
                await StorageService.uploadFileFromPath(filePath, s3Key, true);
              }
            }
          } else {
            throw new Error(`HLS directory not found: ${hlsPath}`);
          }

          // Upload thumbnail
          if (fs.existsSync(thumbnailPath)) {
            const thumbKey = `${processedFolder}/thumbnail.jpg`;
            console.log(`Uploading thumbnail to ${thumbKey}`);
            await StorageService.uploadFileFromPath(thumbnailPath, thumbKey);

            // Update video record
            await pool.query(
              `UPDATE videos SET
                 processed_filename = $1,
                 thumbnail_key     = $2,
                 duration          = $3,
                 status            = $4
               WHERE id = $5`,
              [processedFolder, thumbKey, duration, "ready", video.id]
            );
            console.log(`Video ${video.id} marked as ready`);
          } else {
            console.warn(`Thumbnail not found: ${thumbnailPath}`);
            // Still update video record without thumbnail
            await pool.query(
              `UPDATE videos SET
                 processed_filename = $1,
                 duration          = $2,
                 status            = $3
               WHERE id = $4`,
              [processedFolder, duration, "ready", video.id]
            );
          }
        } catch (err) {
          console.error("Video processing failed:", err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          await pool.query(
            `UPDATE videos SET status = 'failed', error_message = $2 WHERE id = $1`,
            [video.id, errorMessage]
          );
        } finally {
          // Cleanup temp files
          if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          if (hlsPath && fs.existsSync(hlsPath)) {
            fs.rmSync(hlsPath, { recursive: true, force: true });
          }
        }
      });

      res
        .status(202)
        .json({ message: "Video is being processed", videoId: video.id });
    }) as RequestHandler,
  ];

  static getVideo: RequestHandler = async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const { rows } = await pool.query(
      `SELECT v.*, c.name AS channel_name , c.id AS channel_id
       FROM videos v
       JOIN channels c ON v.channel_id = c.id
       WHERE v.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ message: "Video not found" });
      return;
    }

    const video = rows[0];
    await incrementVideoView(Number(id), req.user!.id);

    // Generate signed URLs for media
    const thumbnailUrl = video.thumbnail_key
      ? await StorageService.getSignedUrl(video.thumbnail_key)
      : null;

    const hlsUrl = video.processed_filename
      ? await StorageService.getSignedUrl(
          `${video.processed_filename}/480p.m3u8`
        )
      : null;
    const interactionRes = await pool.query(
      `SELECT is_liked, is_saved FROM video_interactions 
       WHERE user_id = $1 AND video_id = $2`,
      [userId, id]
    );

    const interaction = interactionRes.rows[0] || {
      is_liked: false,
      is_saved: false,
    };
    res.json({
      ...video,
      hlsUrl,
      thumbnailUrl,
      isLiked: interaction.is_liked,
      isSaved: interaction.is_saved,
    });
  };

  static getVideos: RequestHandler = async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const type = req.query.type as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const userId = req.user?.id;

    // Base query with joins
    let baseQuery = `
        SELECT v.id, v.title, v.thumbnail_key, v.duration, v.views, v.created_at,
               c.name AS channel_name, c.avatar as channel_avatar, c.id as channel_id
        FROM videos v
        JOIN channels c ON v.channel_id = c.id
        WHERE v.status = 'ready'
    `;

    // Additional conditions based on type
    const queryParams: any[] = [];
    let orderBy = "ORDER BY v.created_at DESC";
    if (type === "subscriptions" && userId) {
      // Subscription videos - channels the user is subscribed to
      baseQuery += `
            AND c.id IN (
                SELECT channel_id 
                FROM subscriptions 
                WHERE user_id = $${queryParams.length + 1}
            )
        `;
      queryParams.push(userId);
    } else if (type === "trending") {
      // Trending videos - most viewed in last 7 days
      baseQuery += `
            AND v.created_at >= NOW() - INTERVAL '7 days'
        `;
      orderBy = "ORDER BY v.views DESC, v.created_at DESC";
    }

    // Category filter
    if (category) {
      baseQuery += ` AND v.category_id = $${queryParams.length + 1}`;
      queryParams.push(category);
    }

    // Search filter
    if (search) {
      baseQuery += ` AND (v.title ILIKE $${
        queryParams.length + 1
      } OR v.description ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    // Main videos query
    const videosQuery = `
        ${baseQuery}
        ${orderBy}
        LIMIT $${queryParams.length + 1} 
        OFFSET $${queryParams.length + 2}
    `;

    // Count query for pagination
    const countQuery = `
        SELECT COUNT(*) 
        FROM (${baseQuery}) AS total
    `;

    try {
      // Execute both queries in parallel
      const [videosResult, countResult] = await Promise.all([
        pool.query(videosQuery, [...queryParams, limit, offset]),
        pool.query(countQuery, queryParams),
      ]);

      const total = Number(countResult.rows[0].count);
      const videos = await Promise.all(
        videosResult.rows.map(async (video) => {
          const thumbnailUrl = video.thumbnail_key
            ? await StorageService.getSignedUrl(video.thumbnail_key, 3600)
            : null;

          return {
            ...video,
            thumbnailUrl,
          };
        })
      );

      res.json({
        data: videos,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  };

  static getUserVideos: RequestHandler = async (req, res) => {
    const userId = req.user!.id;

    const { rows } = await pool.query<Video>(
      `SELECT v.* 
       FROM videos v
       JOIN channels c ON v.channel_id = c.id
       WHERE c.user_id = $1
       ORDER BY v.created_at DESC`,
      [userId]
    );
    const videos = await Promise.all(
      rows.map(async (video) => {
        const thumbnailUrl = video.thumbnail_key
          ? await StorageService.getSignedUrl(video.thumbnail_key)
          : null;

        return {
          ...video,
          thumbnailUrl,
        };
      })
    );
    res.json(videos);
  };

  static getUserViewedVideos: RequestHandler = async (req, res) => {
    try {
      const userId = req.user!.id; // Get user ID from authenticated request
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      // Query to get paginated viewed videos
      const viewedVideosQuery = `
      SELECT v.*, 
             c.name AS channel_name,
             c.avatar AS channel_avatar,
             c.id AS channel_id
      FROM video_views vv
      JOIN videos v ON vv.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE vv.user_id = $1
      ORDER BY vv.created_at DESC
      LIMIT $2 OFFSET $3
    `;

      // Query to get total count
      const countQuery = `
      SELECT COUNT(*) 
      FROM video_views 
      WHERE user_id = $1
    `;

      // Execute both queries in parallel
      const [videosResult, countResult] = await Promise.all([
        pool.query(viewedVideosQuery, [userId, limit, offset]),
        pool.query(countQuery, [userId]),
      ]);

      const total = Number(countResult.rows[0].count);
      const videos = await Promise.all(
        videosResult.rows.map(async (video: any) => {
          const thumbnailUrl = video.thumbnail_key
            ? await StorageService.getSignedUrl(video.thumbnail_key, 3600)
            : null;

          return {
            ...video,
            thumbnailUrl,
            channel: {
              id: video.channel_id,
              name: video.channel_name,
              avatar: video.channel_avatar,
            },
          };
        })
      );

      res.json({
        data: videos,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch viewed videos:", error);
      res.status(500).json({ message: "Failed to fetch viewed videos" });
    }
  };

  static getLikedVideos: RequestHandler = async (req, res) => {
    try {
      const userId = req.user!.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Query to get paginated liked videos
      const likedVideosQuery = `
      SELECT v.*, 
             c.name AS channel_name,
             c.avatar AS channel_avatar,
             c.id AS channel_id
      FROM video_interactions vi
      JOIN videos v ON vi.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE vi.user_id = $1 AND vi.is_liked = true
      ORDER BY vi.created_at DESC
      LIMIT $2 OFFSET $3
    `;

      // Query to get total count
      const countQuery = `
      SELECT COUNT(*) 
      FROM video_interactions 
      WHERE user_id = $1 AND is_liked = true
    `;

      // Execute both queries in parallel
      const [videosResult, countResult] = await Promise.all([
        pool.query(likedVideosQuery, [userId, limit, offset]),
        pool.query(countQuery, [userId]),
      ]);

      const total = Number(countResult.rows[0].count);
      const videos = await Promise.all(
        videosResult.rows.map(async (video: any) => {
          const thumbnailUrl = video.thumbnail_key
            ? await StorageService.getSignedUrl(video.thumbnail_key, 3600)
            : null;

          return {
            ...video,
            thumbnailUrl,
            channel: {
              id: video.channel_id,
              name: video.channel_name,
              avatar: video.channel_avatar,
            },
          };
        })
      );

      res.json({
        data: videos,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch liked videos:", error);
      res.status(500).json({ message: "Failed to fetch liked videos" });
    }
  };

  static getSavedVideos: RequestHandler = async (req, res) => {
    try {
      const userId = req.user!.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Query to get paginated saved videos
      const savedVideosQuery = `
      SELECT v.*, 
             c.name AS channel_name,
             c.avatar AS channel_avatar,
             c.id AS channel_id
      FROM video_interactions vi
      JOIN videos v ON vi.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE vi.user_id = $1 AND vi.is_saved = true
      ORDER BY vi.created_at DESC
      LIMIT $2 OFFSET $3
    `;

      // Query to get total count
      const countQuery = `
      SELECT COUNT(*) 
      FROM video_interactions 
      WHERE user_id = $1 AND is_saved = true
    `;

      // Execute both queries in parallel
      const [videosResult, countResult] = await Promise.all([
        pool.query(savedVideosQuery, [userId, limit, offset]),
        pool.query(countQuery, [userId]),
      ]);

      const total = Number(countResult.rows[0].count);
      const videos = await Promise.all(
        videosResult.rows.map(async (video: any) => {
          const thumbnailUrl = video.thumbnail_key
            ? await StorageService.getSignedUrl(video.thumbnail_key, 3600)
            : null;

          return {
            ...video,
            thumbnailUrl,
            channel: {
              id: video.channel_id,
              name: video.channel_name,
              avatar: video.channel_avatar,
            },
          };
        })
      );

      res.json({
        data: videos,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch saved videos:", error);
      res.status(500).json({ message: "Failed to fetch saved videos" });
    }
  };
  static getChannelVideos: RequestHandler = async (req, res) => {
    try {
      const channelId = req.params.channelId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Query to get paginated channel videos
      const videosQuery = `
      SELECT v.*, 
             c.name AS channel_name,
             c.avatar AS channel_avatar,
             c.id AS channel_id
      FROM videos v
      JOIN channels c ON v.channel_id = c.id
      WHERE v.channel_id = $1 AND v.status = 'ready'
      ORDER BY v.created_at DESC
      LIMIT $2 OFFSET $3
    `;

      // Query to get total count
      const countQuery = `
      SELECT COUNT(*) 
      FROM videos 
      WHERE channel_id = $1 AND status = 'ready'
    `;

      // Execute both queries in parallel
      const [videosResult, countResult] = await Promise.all([
        pool.query(videosQuery, [channelId, limit, offset]),
        pool.query(countQuery, [channelId]),
      ]);

      const total = Number(countResult.rows[0].count);
      const videos = await Promise.all(
        videosResult.rows.map(async (video: any) => {
          const thumbnailUrl = video.thumbnail_key
            ? await StorageService.getSignedUrl(video.thumbnail_key, 3600)
            : null;

          return {
            ...video,
            thumbnailUrl,
            channel: {
              id: video.channel_id,
              name: video.channel_name,
              avatar: video.channel_avatar,
            },
          };
        })
      );

      res.json({
        data: videos,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch channel videos:", error);
      res.status(500).json({ message: "Failed to fetch channel videos" });
    }
  };
}
export async function incrementVideoView(videoId: number, userId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if user already viewed
    const viewCheck = await client.query(
      `SELECT 1 FROM video_views WHERE user_id = $1 AND video_id = $2`,
      [userId, videoId]
    );

    if (viewCheck.rowCount === 0) {
      // Record new view
      await client.query(
        `INSERT INTO video_views (user_id, video_id) VALUES ($1, $2)`,
        [userId, videoId]
      );

      // Increment view count
      await client.query(`UPDATE videos SET views = views + 1 WHERE id = $1`, [
        videoId,
      ]);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
