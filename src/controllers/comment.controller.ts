// controllers/comment.controller.ts
import { Request, Response } from "express";
import pool from "../models";

/**
 * GET all comments for a video
 */
export const getCommentsByVideo = async (req: Request, res: Response) => {
  const videoId = Number(req.params.videoId);
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.username, u.avatar_url,
              COALESCE(ci.is_liked, false) AS is_liked,
              COALESCE(ci.is_disliked, false) AS is_disliked
       FROM comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN comment_interactions ci
         ON ci.comment_id = c.id AND ci.user_id = $2
       WHERE c.video_id = $1
       ORDER BY c.created_at DESC`,
      [videoId, req.user!.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("fetch comments error:", err);
    res.status(500).json({ error: "Failed to load comments." });
  }
};

/**
 * Create a new comment
 */
export const createComment = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { videoId, text } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO comments (user_id, video_id, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, videoId, text]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("create comment error:", err);
    res.status(500).json({ error: "Failed to post comment." });
  }
};

/**
 * Toggle like on a comment
 */
export const toggleCommentLike = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const commentId = Number(req.params.commentId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT is_liked, is_disliked FROM comment_interactions
       WHERE user_id=$1 AND comment_id=$2 FOR UPDATE`,
      [userId, commentId]
    );
    let liked = false;
    if (rows.length === 0) {
      // insert new liked
      await client.query(
        `INSERT INTO comment_interactions
           (user_id, comment_id, is_liked, is_disliked)
         VALUES ($1, $2, TRUE, FALSE)`,
        [userId, commentId]
      );
      await client.query(
        `UPDATE comments SET likes = likes + 1 WHERE id = $1`,
        [commentId]
      );
      liked = true;
    } else {
      const { is_liked, is_disliked } = rows[0];
      if (is_liked) {
        // undo like
        await client.query(
          `UPDATE comment_interactions
             SET is_liked = FALSE
           WHERE user_id=$1 AND comment_id=$2`,
          [userId, commentId]
        );
        await client.query(
          `UPDATE comments SET likes = GREATEST(likes - 1, 0) WHERE id=$1`,
          [commentId]
        );
        liked = false;
      } else {
        // switch to like
        await client.query(
          `UPDATE comment_interactions
             SET is_liked = TRUE, is_disliked = FALSE
           WHERE user_id=$1 AND comment_id=$2`,
          [userId, commentId]
        );
        await client.query(
          `UPDATE comments SET likes = likes + 1 WHERE id=$1`,
          [commentId]
        );
        if (is_disliked) {
          await client.query(
            `UPDATE comments SET dislikes = GREATEST(dislikes - 1, 0) WHERE id=$1`,
            [commentId]
          );
        }
        liked = true;
      }
    }
    await client.query("COMMIT");
    res.json({ liked });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("toggle like error:", err);
    res.status(500).json({ error: "Failed to toggle like." });
  } finally {
    client.release();
  }
};

/**
 * Toggle dislike on a comment
 */
export const toggleCommentDislike = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const commentId = Number(req.params.commentId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT is_liked, is_disliked FROM comment_interactions
       WHERE user_id=$1 AND comment_id=$2 FOR UPDATE`,
      [userId, commentId]
    );
    let disliked = false;
    if (rows.length === 0) {
      await client.query(
        `INSERT INTO comment_interactions
           (user_id, comment_id, is_liked, is_disliked)
         VALUES ($1, $2, FALSE, TRUE)`,
        [userId, commentId]
      );
      await client.query(
        `UPDATE comments SET dislikes = dislikes + 1 WHERE id = $1`,
        [commentId]
      );
      disliked = true;
    } else {
      const { is_liked, is_disliked } = rows[0];
      if (is_disliked) {
        await client.query(
          `UPDATE comment_interactions
             SET is_disliked = FALSE
           WHERE user_id=$1 AND comment_id=$2`,
          [userId, commentId]
        );
        await client.query(
          `UPDATE comments SET dislikes = GREATEST(dislikes - 1, 0) WHERE id=$1`,
          [commentId]
        );
        disliked = false;
      } else {
        await client.query(
          `UPDATE comment_interactions
             SET is_disliked = TRUE, is_liked = FALSE
           WHERE user_id=$1 AND comment_id=$2`,
          [userId, commentId]
        );
        await client.query(
          `UPDATE comments SET dislikes = dislikes + 1 WHERE id=$1`,
          [commentId]
        );
        if (is_liked) {
          await client.query(
            `UPDATE comments SET likes = GREATEST(likes - 1, 0) WHERE id=$1`,
            [commentId]
          );
        }
        disliked = true;
      }
    }
    await client.query("COMMIT");
    res.json({ disliked });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("toggle dislike error:", err);
    res.status(500).json({ error: "Failed to toggle dislike." });
  } finally {
    client.release();
  }
};

/**
 * Update a comment
 */
export const updateComment = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const commentId = Number(req.params.commentId);
  const { text } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE comments SET text = $1 WHERE id = $2 AND user_id = $3`,
      [text, commentId, userId]
    );
    if (!rowCount) {
      res.status(404).json({ error: "Comment not found." });
      res.json({ message: "Comment updated." });
      return;
    }
  } catch (err) {
    console.error("update comment error:", err);
    res.status(500).json({ error: "Failed to update comment." });
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const commentId = Number(req.params.commentId);
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM comments WHERE id = $1 AND user_id = $2`,
      [commentId, userId]
    );
    if (!rowCount) {
      res.status(404).json({ error: "Comment not found." });
      res.json({ message: "Comment deleted." });
      return;
    }
  } catch (err) {
    console.error("delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment." });
  }
};
