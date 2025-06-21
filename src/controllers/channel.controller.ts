// controllers/channelController.ts
import { Request, Response } from "express";
import pool from "../models"; // assuming `models/index.ts` exports your pg Pool

export class ChannelController {
  static getChannelsByUserId = async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    try {
      const { rows } = await pool.query(
        `SELECT * FROM channels WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching channels by user_id:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  static getChannelById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
      const { rows } = await pool.query(
        `SELECT * FROM channels WHERE id = $1`,
        [id]
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.json(rows[0]);
    } catch (err) {
      console.error("Error fetching channel by id:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  static createChannel = async (req: Request, res: Response) => {
    const {
      user_id,
      name,
      avatar,
      subscribers = 0,
      verified = false,
    } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO channels (user_id, name, avatar, subscribers, verified)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, name, avatar, subscribers, verified]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Error creating channel:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  static updateChannel = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { name, avatar, subscribers, verified } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE channels
         SET
           name        = COALESCE($1, name),
           avatar      = COALESCE($2, avatar),
           subscribers = COALESCE($3, subscribers),
           verified    = COALESCE($4, verified)
         WHERE id = $5
         RETURNING *`,
        [name, avatar, subscribers, verified, id]
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.json(rows[0]);
    } catch (err) {
      console.error("Error updating channel:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
