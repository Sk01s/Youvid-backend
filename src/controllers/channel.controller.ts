import { Request, Response } from "express";
import { ChannelRepository } from "../repositories/channel.repository";
import { NewChannel } from "../types/channel.types";

const repo = new ChannelRepository();

export class ChannelController {
  static getChannelByUserId = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = Number(req.params.userId);
    try {
      const channels = await repo.findByUserId(userId);
      res.json(channels);
    } catch (err) {
      console.error("Error fetching channels by user_id:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
  static getChannelsForUserId = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.id;
    try {
      const channels = await repo.getForUserId(userId);
      res.json(channels);
    } catch (err) {
      console.error("Error fetching channels by user_id:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  static getChannelById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const id = Number(req.params.id);
    try {
      const channel = await repo.findById(id);
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.json(channel);
    } catch (err) {
      console.error("Error fetching channel by id:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  static createChannel = async (req: Request, res: Response): Promise<void> => {
    const payload: NewChannel = req.body;
    try {
      const created = await repo.create(payload);
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating channel:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  static updateChannel = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const updates = req.body;
    try {
      const updated = await repo.update(id, updates);
      if (!updated) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      console.error("Error updating channel:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
