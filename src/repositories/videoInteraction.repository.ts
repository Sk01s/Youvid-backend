// repositories/videoInteraction.repository.ts
import pool from "../db/pool";
import { VideoInteractionStatus } from "../types/videoInteraction.types";

export class VideoInteractionRepository {
  async toggleLike(userId: number, videoId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rowCount, rows } = await client.query<{ is_liked: boolean }>(
        `SELECT is_liked FROM video_interactions WHERE user_id=$1 AND video_id=$2 FOR UPDATE`,
        [userId, videoId]
      );

      let isLiked: boolean;
      let delta: number;
      if (rowCount === 0) {
        const insert = await client.query<{ is_liked: boolean }>(
          `INSERT INTO video_interactions (user_id, video_id, is_liked) VALUES ($1,$2,TRUE) RETURNING is_liked`,
          [userId, videoId]
        );
        isLiked = insert.rows[0].is_liked;
        delta = 1;
      } else {
        const updateRes = await client.query<{ is_liked: boolean }>(
          `UPDATE video_interactions SET is_liked = NOT is_liked WHERE user_id=$1 AND video_id=$2 RETURNING is_liked`,
          [userId, videoId]
        );
        isLiked = updateRes.rows[0].is_liked;
        delta = isLiked ? 1 : -1;
      }
      await client.query(`UPDATE videos SET likes = likes + $1 WHERE id=$2`, [
        delta,
        videoId,
      ]);
      await client.query("COMMIT");
      return isLiked;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async toggleSave(userId: number, videoId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rowCount, rows } = await client.query<{ is_saved: boolean }>(
        `SELECT is_saved FROM video_interactions WHERE user_id=$1 AND video_id=$2 FOR UPDATE`,
        [userId, videoId]
      );

      let isSaved: boolean;
      if (rowCount === 0) {
        const insert = await client.query<{ is_saved: boolean }>(
          `INSERT INTO video_interactions (user_id, video_id, is_saved) VALUES ($1,$2,TRUE) RETURNING is_saved`,
          [userId, videoId]
        );
        isSaved = insert.rows[0].is_saved;
      } else {
        const updateRes = await client.query<{ is_saved: boolean }>(
          `UPDATE video_interactions SET is_saved = NOT is_saved WHERE user_id=$1 AND video_id=$2 RETURNING is_saved`,
          [userId, videoId]
        );
        isSaved = updateRes.rows[0].is_saved;
      }
      await client.query("COMMIT");
      return isSaved;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getUserInteractions(
    userId: number
  ): Promise<Record<number, VideoInteractionStatus>> {
    const { rows } = await pool.query<{
      video_id: number;
      is_liked: boolean;
      is_saved: boolean;
    }>(
      `SELECT video_id, is_liked, is_saved FROM video_interactions WHERE user_id=$1`,
      [userId]
    );
    return rows.reduce<Record<number, VideoInteractionStatus>>((acc, r) => {
      acc[r.video_id] = { isLiked: r.is_liked, isSaved: r.is_saved };
      return acc;
    }, {});
  }
}
