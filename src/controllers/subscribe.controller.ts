// controllers/subscription.controller.ts
import { Request, Response } from "express";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { SubscriptionStatus } from "../types/subscription.types";

const repo = new SubscriptionRepository();

export class SubscriptionController {
  static getStatus = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const channelId = Number(req.params.channelId);
    try {
      const status: SubscriptionStatus = await repo.getStatus(
        userId,
        channelId
      );
      res.status(200).json(status);
    } catch (err) {
      console.error("Error fetching subscription status:", err);
      res.status(500).json({ error: "Failed to fetch subscription status." });
    }
  };

  static toggle = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const channelId = Number(req.params.channelId);
    try {
      const subscribed = await repo.toggle(userId, channelId);
      res.status(200).json({
        message: subscribed
          ? "Subscribed successfully."
          : "Unsubscribed successfully.",
        subscribed,
      });
    } catch (err) {
      console.error("Error toggling subscription:", err);
      res.status(500).json({ error: "Failed to toggle subscription." });
    }
  };
}
