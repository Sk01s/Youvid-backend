import { Request, Response } from "express";
import pool from "../models";

/**
 * GET /channels/:channelId/subscription
 * Returns whether the current user is subscribed to the channel
 */
export const getSubscriptionStatusController = async (
  req: Request,
  res: Response
) => {
  const userId = req.user!.id;
  const channelId = Number(req.params.channelId);

  try {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM subscriptions WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId]
    );
    const isSubscribed = rowCount ? rowCount > 0 : 0;
    res.status(200).json({ isSubscribed });
    return;
  } catch (err) {
    console.error("get subscription status error:", err);
    res.status(500).json({ error: "Failed to fetch subscription status." });
    return;
  }
};

/**
 * POST /channels/:channelId/subscription-toggle
 * Toggles subscription: subscribes if not already, unsubscribes if exists.
 */
export const toggleSubscriptionController = async (
  req: Request,
  res: Response
) => {
  const userId = req.user!.id; // assume auth middleware
  const channelId = Number(req.params.channelId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check existing subscription
    const { rowCount: exists } = await client.query(
      `SELECT 1 FROM subscriptions WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId]
    );

    if (exists) {
      // Unsubscribe flow
      await client.query(
        `DELETE FROM subscriptions WHERE user_id = $1 AND channel_id = $2`,
        [userId, channelId]
      );

      await client.query(
        `INSERT INTO subscription_history (user_id, channel_id, action)
           VALUES ($1, $2, 'unsubscribed')`,
        [userId, channelId]
      );

      await client.query(
        `UPDATE channels
           SET subscribers = GREATEST(subscribers - 1, 0)
         WHERE id = $1`,
        [channelId]
      );

      await client.query("COMMIT");
      res
        .status(200)
        .json({ message: "Unsubscribed successfully.", subscribed: false });
      return;
    }

    // Subscribe flow
    await client.query(
      `INSERT INTO subscriptions (user_id, channel_id)
         VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, channelId]
    );

    await client.query(
      `INSERT INTO subscription_history (user_id, channel_id, action)
         VALUES ($1, $2, 'subscribed')`,
      [userId, channelId]
    );

    await client.query(
      `UPDATE channels
         SET subscribers = subscribers + 1
       WHERE id = $1`,
      [channelId]
    );

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "Subscribed successfully.", subscribed: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("toggle subscription error:", err);
    res.status(500).json({ error: "Failed to toggle subscription." });
  } finally {
    client.release();
  }
};

// --- Router setup ---
import express from "express";
const router = express.Router();

// Toggle subscription

export default router;
