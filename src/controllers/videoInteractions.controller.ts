import { RequestHandler } from "express";
import pool from "../models";

export class VideoInteractionController {
  static toggleLike: RequestHandler = async (req, res) => {
    const { id: videoId } = req.params;
    const userId = req.user!.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check for existing interaction
      const { rowCount, rows } = await client.query<{ is_liked: boolean }>(
        `SELECT is_liked
         FROM video_interactions
         WHERE user_id = $1 AND video_id = $2
         FOR UPDATE`,
        [userId, videoId]
      );

      let isLiked: boolean;
      let delta: number;

      if (rowCount === 0) {
        // Create new like
        const insertResult = await client.query<{ is_liked: boolean }>(
          `INSERT INTO video_interactions (user_id, video_id, is_liked)
           VALUES ($1, $2, TRUE)
           RETURNING is_liked`,
          [userId, videoId]
        );
        isLiked = insertResult.rows[0].is_liked;
        delta = 1;
      } else {
        // Toggle existing like
        const current = rows[0].is_liked;
        const updateResult = await client.query<{ is_liked: boolean }>(
          `UPDATE video_interactions
           SET is_liked = NOT is_liked
           WHERE user_id = $1 AND video_id = $2
           RETURNING is_liked`,
          [userId, videoId]
        );
        isLiked = updateResult.rows[0].is_liked;
        delta = isLiked ? 1 : -1;
      }

      // Update video like count
      await client.query(
        `UPDATE videos
         SET likes = likes + $1
         WHERE id = $2`,
        [delta, videoId]
      );

      await client.query("COMMIT");
      res.json({ isLiked });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to toggle like:", err);
      res.status(500).json({ message: "Failed to toggle like status" });
    } finally {
      client.release();
    }
  };

  static toggleSave: RequestHandler = async (req, res) => {
    const { id: videoId } = req.params;
    const userId = req.user!.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check for existing interaction
      const { rowCount, rows } = await client.query<{ is_saved: boolean }>(
        `SELECT is_saved
         FROM video_interactions
         WHERE user_id = $1 AND video_id = $2
         FOR UPDATE`,
        [userId, videoId]
      );

      let isSaved: boolean;

      if (rowCount === 0) {
        // Create new save
        const insertResult = await client.query<{ is_saved: boolean }>(
          `INSERT INTO video_interactions (user_id, video_id, is_saved)
           VALUES ($1, $2, TRUE)
           RETURNING is_saved`,
          [userId, videoId]
        );
        isSaved = insertResult.rows[0].is_saved;
      } else {
        // Toggle existing save
        const updateResult = await client.query<{ is_saved: boolean }>(
          `UPDATE video_interactions
           SET is_saved = NOT is_saved
           WHERE user_id = $1 AND video_id = $2
           RETURNING is_saved`,
          [userId, videoId]
        );
        isSaved = updateResult.rows[0].is_saved;
      }

      await client.query("COMMIT");
      res.json({ isSaved });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to toggle save:", err);
      res.status(500).json({ message: "Failed to toggle save status" });
    } finally {
      client.release();
    }
  };

  static getUserInteractions: RequestHandler = async (req, res) => {
    const userId = req.user!.id;

    try {
      const result = await pool.query(
        `SELECT video_id, is_liked, is_saved
         FROM video_interactions
         WHERE user_id = $1`,
        [userId]
      );

      const interactions = result.rows.reduce<
        Record<string, { isLiked: boolean; isSaved: boolean }>
      >((acc, row) => {
        acc[row.video_id] = {
          isLiked: row.is_liked,
          isSaved: row.is_saved,
        };
        return acc;
      }, {});

      res.json(interactions);
    } catch (err) {
      console.error("Failed to get interactions:", err);
      res.status(500).json({ message: "Failed to get user interactions" });
    }
  };
}
