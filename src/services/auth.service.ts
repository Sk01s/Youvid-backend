// src/services/auth.service.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../models";
import { User } from "../models";

export class AuthService {
  /**
   * If a user with this email exists, verify password and return.
   * Otherwise create a new user with the provided username/email/password.
   */
  static async authenticate(
    email: string,
    password: string,
    username?: string
  ): Promise<{ user: User; token: string }> {
    // 1. Look up existing user
    const findRes = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);

    let user: User;
    if (findRes.rows.length === 0) {
      // 2a. No user -> must have provided username to register
      if (!username) {
        throw new Error("Username required to register new account");
      }
      const hashed = await bcrypt.hash(password, 10);
      const insertRes = await pool.query(
        `INSERT INTO users (username, email, password)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [username, email, hashed]
      );
      user = insertRes.rows[0];
    } else {
      // 2b. User exists -> verify password
      user = findRes.rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        throw new Error("Invalid credentials");
      }
    }

    // 3. Issue JWT
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    return { user, token };
  }

  static verifyToken(token: string): any {
    return jwt.verify(token, process.env.JWT_SECRET!);
  }
}
