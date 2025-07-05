// controllers/comment.controller.ts
import { Request, Response } from "express";
import { CommentRepository } from "../repositories/comment.repository";
import { NewComment } from "../types/comment.types";

const repo = new CommentRepository();

export class CommentController {
  static getByVideo = async (req: Request, res: Response): Promise<void> => {
    const videoId = Number(req.params.videoId);
    const userId = req.user!.id;
    try {
      const comments = await repo.findByVideo(videoId, userId);
      res.json(comments);
    } catch (err) {
      console.error("fetch comments error:", err);
      res.status(500).json({ error: "Failed to load comments." });
    }
  };

  static create = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const payload: NewComment = req.body;
    try {
      const comment = await repo.create(userId, payload);
      res.status(201).json(comment);
    } catch (err) {
      console.error("create comment error:", err);
      res.status(500).json({ error: "Failed to post comment." });
    }
  };

  static toggleLike = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const commentId = Number(req.params.commentId);
    try {
      const liked = await repo.toggleLike(userId, commentId);
      res.json({ liked });
    } catch (err) {
      console.error("toggle like error:", err);
      res.status(500).json({ error: "Failed to toggle like." });
    }
  };

  static toggleDislike = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const commentId = Number(req.params.commentId);
    try {
      const disliked = await repo.toggleDislike(userId, commentId);
      res.json({ disliked });
    } catch (err) {
      console.error("toggle dislike error:", err);
      res.status(500).json({ error: "Failed to toggle dislike." });
    }
  };

  static update = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const commentId = Number(req.params.commentId);
    const { text } = req.body;
    try {
      const updated = await repo.update(userId, commentId, text);
      if (!updated) {
        res.status(404).json({ error: "Comment not found." });
        return;
      }
      res.json({ message: "Comment updated." });
    } catch (err) {
      console.error("update comment error:", err);
      res.status(500).json({ error: "Failed to update comment." });
    }
  };

  static delete = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const commentId = Number(req.params.commentId);
    try {
      const deleted = await repo.delete(userId, commentId);
      if (!deleted) {
        res.status(404).json({ error: "Comment not found." });
        return;
      }
      res.json({ message: "Comment deleted." });
    } catch (err) {
      console.error("delete comment error:", err);
      res.status(500).json({ error: "Failed to delete comment." });
    }
  };
}
