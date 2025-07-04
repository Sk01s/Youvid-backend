// repositories/auth.repository.ts
import pool from "../db/pool";
import { UserProfile } from "../types/auth.types";

export class AuthRepository {
  async findUserProfileById(id: number): Promise<UserProfile | null> {
    const { rows } = await pool.query<UserProfile>(
      `SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }
}
