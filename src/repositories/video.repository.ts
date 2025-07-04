import pool from "../db/pool";
import {
  PaginatedResult,
  Video,
  VideoFilterParams,
  VideoInteraction,
  VideoListItem,
  VideoView,
  VideoWithChannel,
} from "../types/video.types";

export class VideoRepository {
  async getChannelByUserId(userId: number): Promise<{ id: number } | null> {
    const res = await pool.query(`SELECT id FROM channels WHERE user_id = $1`, [
      userId,
    ]);
    return res.rows[0] || null;
  }

  async createVideo(videoData: {
    channelId: number;
    categoryId: number | null;
    title: string;
    description: string;
    originalFilename: string;
    status: string;
  }): Promise<Video> {
    const result = await pool.query<Video>(
      `INSERT INTO videos (channel_id, category_id, title, description, original_filename, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        videoData.channelId,
        videoData.categoryId,
        videoData.title,
        videoData.description,
        videoData.originalFilename,
        videoData.status,
      ]
    );
    return result.rows[0];
  }

  async getVideoById(id: number): Promise<VideoWithChannel | null> {
    const { rows } = await pool.query(
      `SELECT v.*, c.name AS channel_name, c.id AS channel_id
             FROM videos v
             JOIN channels c ON v.channel_id = c.id
             WHERE v.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getVideoInteraction(
    userId: number,
    videoId: number
  ): Promise<VideoInteraction | null> {
    const res = await pool.query(
      `SELECT is_liked, is_saved FROM video_interactions 
             WHERE user_id = $1 AND video_id = $2`,
      [userId, videoId]
    );
    return res.rows[0] || null;
  }

  async incrementVideoView(videoId: number, userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const viewCheck = await client.query(
        `SELECT 1 FROM video_views WHERE user_id = $1 AND video_id = $2`,
        [userId, videoId]
      );

      if (viewCheck.rowCount === 0) {
        await client.query(
          `INSERT INTO video_views (user_id, video_id) VALUES ($1, $2)`,
          [userId, videoId]
        );
        await client.query(
          `UPDATE videos SET views = views + 1 WHERE id = $1`,
          [videoId]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getPaginatedVideos(
    filter: VideoFilterParams
  ): Promise<PaginatedResult<VideoListItem>> {
    let baseQuery = `
            SELECT v.id, v.title, v.thumbnail_key, v.duration, v.views, v.created_at,
                   c.name AS channel_name, c.avatar as channel_avatar, c.id as channel_id
            FROM videos v
            JOIN channels c ON v.channel_id = c.id
            WHERE v.status = 'ready'
        `;

    const params: any[] = [];
    let orderBy = "ORDER BY v.created_at DESC";

    if (filter.type === "subscriptions" && filter.userId) {
      baseQuery += `
                AND c.id IN (
                    SELECT channel_id 
                    FROM subscriptions 
                    WHERE user_id = $${params.length + 1}
                )
            `;
      params.push(filter.userId);
    } else if (filter.type === "trending") {
      baseQuery += ` AND v.created_at >= NOW() - INTERVAL '7 days'`;
      orderBy = "ORDER BY v.views DESC, v.created_at DESC";
    }

    if (filter.category) {
      baseQuery += ` AND v.category_id = $${params.length + 1}`;
      params.push(filter.category);
    }

    if (filter.search) {
      baseQuery += ` AND (v.title ILIKE $${
        params.length + 1
      } OR v.description ILIKE $${params.length + 1})`;
      params.push(`%${filter.search}%`);
    }

    const videosQuery = `
            ${baseQuery}
            ${orderBy}
            LIMIT $${params.length + 1} 
            OFFSET $${params.length + 2}
        `;

    const countQuery = `
            SELECT COUNT(*) 
            FROM (${baseQuery}) AS total
        `;

    const [videosResult, countResult] = await Promise.all([
      pool.query<VideoListItem>(videosQuery, [
        ...params,
        filter.limit,
        filter.offset,
      ]),
      pool.query(countQuery, params),
    ]);

    return {
      data: videosResult.rows,
      total: Number(countResult.rows[0].count),
    };
  }

  async getUserVideos(userId: number): Promise<Video[]> {
    const { rows } = await pool.query<Video>(
      `SELECT v.* 
             FROM videos v
             JOIN channels c ON v.channel_id = c.id
             WHERE c.user_id = $1
             ORDER BY v.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async getUserViewedVideos(
    userId: number,
    limit: number,
    offset: number
  ): Promise<PaginatedResult<VideoView>> {
    const videosQuery = `
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

    const countQuery = `
            SELECT COUNT(*) 
            FROM video_views 
            WHERE user_id = $1
        `;

    const [videosResult, countResult] = await Promise.all([
      pool.query<VideoView>(videosQuery, [userId, limit, offset]),
      pool.query(countQuery, [userId]),
    ]);

    return {
      data: videosResult.rows,
      total: Number(countResult.rows[0].count),
    };
  }

  async getLikedVideos(
    userId: number,
    limit: number,
    offset: number
  ): Promise<PaginatedResult<VideoView>> {
    const videosQuery = `
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

    const countQuery = `
            SELECT COUNT(*) 
            FROM video_interactions 
            WHERE user_id = $1 AND is_liked = true
        `;

    const [videosResult, countResult] = await Promise.all([
      pool.query<VideoView>(videosQuery, [userId, limit, offset]),
      pool.query(countQuery, [userId]),
    ]);

    return {
      data: videosResult.rows,
      total: Number(countResult.rows[0].count),
    };
  }

  async getSavedVideos(
    userId: number,
    limit: number,
    offset: number
  ): Promise<PaginatedResult<VideoView>> {
    const videosQuery = `
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

    const countQuery = `
            SELECT COUNT(*) 
            FROM video_interactions 
            WHERE user_id = $1 AND is_saved = true
        `;

    const [videosResult, countResult] = await Promise.all([
      pool.query<VideoView>(videosQuery, [userId, limit, offset]),
      pool.query(countQuery, [userId]),
    ]);

    return {
      data: videosResult.rows,
      total: Number(countResult.rows[0].count),
    };
  }

  async getChannelVideos(
    channelId: number,
    limit: number,
    offset: number
  ): Promise<PaginatedResult<VideoListItem>> {
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

    const countQuery = `
            SELECT COUNT(*) 
            FROM videos 
            WHERE channel_id = $1 AND status = 'ready'
        `;

    const [videosResult, countResult] = await Promise.all([
      pool.query<VideoListItem>(videosQuery, [channelId, limit, offset]),
      pool.query(countQuery, [channelId]),
    ]);

    return {
      data: videosResult.rows,
      total: Number(countResult.rows[0].count),
    };
  }
}
