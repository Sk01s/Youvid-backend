import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import pool, { Video } from "../models";
import { StorageService } from "../services/storage.service";
import { FFmpegService } from "../services/ffmpeg.service";
import { AuthService } from "../services/auth.service";

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

    const videosResult = await pool.query(
      `SELECT v.id, v.title, v.thumbnail_key, v.duration, v.views, v.created_at,
      c.name AS channel_name , c.avatar as channel_avatar,
      c.id as channel_id
       FROM videos v
       JOIN channels c ON v.channel_id = c.id
       WHERE v.status = 'ready'
       ORDER BY v.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos WHERE status = 'ready'`
    );

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
