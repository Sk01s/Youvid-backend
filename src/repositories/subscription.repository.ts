// repositories/subscription.repository.ts
import pool from "../db/pool";
import { SubscriptionStatus } from "../types/subscription.types";

export class SubscriptionRepository {
  async getStatus(
    userId: number,
    channelId: number
  ): Promise<SubscriptionStatus> {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM subscriptions WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId]
    );
    return { isSubscribed: rowCount ? rowCount > 0 : false };
  }

  async toggle(userId: number, channelId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rowCount: exists } = await client.query(
        `SELECT 1 FROM subscriptions WHERE user_id = $1 AND channel_id = $2`,
        [userId, channelId]
      );

      if (exists) {
        // Unsubscribe
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
          `UPDATE channels SET subscribers = GREATEST(subscribers - 1, 0) WHERE id = $1`,
          [channelId]
        );
        await client.query("COMMIT");
        return false;
      }

      // Subscribe
      await client.query(
        `INSERT INTO subscriptions (user_id, channel_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, channelId]
      );
      await client.query(
        `INSERT INTO subscription_history (user_id, channel_id, action)
           VALUES ($1, $2, 'subscribed')`,
        [userId, channelId]
      );
      await client.query(
        `UPDATE channels SET subscribers = subscribers + 1 WHERE id = $1`,
        [channelId]
      );
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
