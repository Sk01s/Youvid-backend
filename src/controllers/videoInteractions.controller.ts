// controllers/videoInteraction.controller.ts
import { Request, Response } from "express";
import { VideoInteractionRepository } from "../repositories/videoInteraction.repository";

const repo = new VideoInteractionRepository();

export class VideoInteractionController {
  static toggleLike = async (req: Request, res: Response): Promise<void> => {
    const videoId = Number(req.params.id);
    const userId = req.user!.id;
    try {
      const isLiked = await repo.toggleLike(userId, videoId);
      res.json({ isLiked });
    } catch (err) {
      console.error("Failed to toggle like:", err);
      res.status(500).json({ message: "Failed to toggle like status" });
    }
  };

  static toggleSave = async (req: Request, res: Response): Promise<void> => {
    const videoId = Number(req.params.id);
    const userId = req.user!.id;
    try {
      const isSaved = await repo.toggleSave(userId, videoId);
      res.json({ isSaved });
    } catch (err) {
      console.error("Failed to toggle save:", err);
      res.status(500).json({ message: "Failed to toggle save status" });
    }
  };

  static getUserInteractions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.id;
    try {
      const interactions = await repo.getUserInteractions(userId);
      res.json(interactions);
    } catch (err) {
      console.error("Failed to get interactions:", err);
      res.status(500).json({ message: "Failed to get user interactions" });
    }
  };
}
