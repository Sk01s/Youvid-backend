// repositories/comment.repository.ts
import pool from "../db/pool";
import { Comment, NewComment } from "../types/comment.types";

export class CommentRepository {
  async findByVideo(videoId: number, userId: number): Promise<Comment[]> {
    const { rows } = await pool.query<Comment>(
      `SELECT c.*, u.username, u.avatar_url,
              COALESCE(ci.is_liked, false) AS is_liked,
              COALESCE(ci.is_disliked, false) AS is_disliked
       FROM comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN comment_interactions ci
         ON ci.comment_id = c.id AND ci.user_id = $2
       WHERE c.video_id = $1
       ORDER BY c.created_at DESC`,
      [videoId, userId]
    );
    return rows;
  }

  async create(userId: number, comment: NewComment): Promise<Comment> {
    const { rows } = await pool.query<Comment>(
      `INSERT INTO comments (user_id, video_id, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, comment.videoId, comment.text]
    );
    return rows[0];
  }

  async toggleLike(userId: number, commentId: number): Promise<boolean> {
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
      return liked;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async toggleDislike(userId: number, commentId: number): Promise<boolean> {
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
      return disliked;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async update(
    userId: number,
    commentId: number,
    text: string
  ): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE comments SET text = $1 WHERE id = $2 AND user_id = $3`,
      [text, commentId, userId]
    );
    return rowCount ? rowCount > 0 : false;
  }

  async delete(userId: number, commentId: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM comments WHERE id = $1 AND user_id = $2`,
      [commentId, userId]
    );
    return rowCount ? rowCount > 0 : false;
  }
}
