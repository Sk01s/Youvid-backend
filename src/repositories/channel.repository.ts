import pool from "../db/pool";
import { Channel, NewChannel } from "../types/channel.types";

export class ChannelRepository {
  async findByUserId(userId: number): Promise<Channel[]> {
    const { rows } = await pool.query<Channel>(
      `SELECT * FROM channels WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }
  async getForUserId(userId: number): Promise<Channel[]> {
    const { rows } = await pool.query<Channel>(
      `SELECT c.* FROM channels c 
JOIN subscriptions s  on s.channel_id = c.id  WHERE s.user_id = $1`,
      [userId]
    );
    return rows;
  }
  async findById(id: number): Promise<Channel | null> {
    const { rows } = await pool.query<Channel>(
      `SELECT * FROM channels WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async create(data: NewChannel): Promise<Channel> {
    const {
      userId,
      name,
      avatar = null,
      subscribers = 0,
      verified = false,
    } = data;

    const { rows } = await pool.query<Channel>(
      `INSERT INTO channels
         (user_id, name, avatar, subscribers, verified)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [userId, name, avatar, subscribers, verified]
    );
    return rows[0];
  }

  async update(
    id: number,
    updates: Partial<Omit<Channel, "id" | "user_id" | "created_at">>
  ): Promise<Channel | null> {
    const { name, avatar, subscribers, verified } = updates;
    const { rows } = await pool.query<Channel>(
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
    return rows[0] || null;
  }
}
