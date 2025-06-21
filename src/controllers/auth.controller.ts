// src/controllers/auth.controller.ts
import { RequestHandler } from "express";
import { AuthService } from "../services/auth.service";
import pool from "../models";

export class AuthController {
  /**
   * POST /api/auth/authenticate
   * Body: { email, password, username? }
   */
  static authenticate: RequestHandler = async (req, res) => {
    try {
      const { email, password, username } = req.body;
      const { user, token } = await AuthService.authenticate(
        email,
        password,
        username
      );

      // strip password before returning
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userData } = user;
      res.json({ user: userData, token });
      return; // <— void return
    } catch (err: any) {
      if (err.message === "Invalid credentials") {
        res.status(401).json({ message: err.message });
        return; // <— void return
      }
      if (err.message.includes("Username")) {
        res.status(400).json({
          message: "Username is required to register a new user",
        });
        return; // <— void return
      }
      res.status(500).json({ message: "Authentication failed" });
      return; // <— void return
    }
  };

  /**
   * POST /api/auth/logout
   */
  static logout: RequestHandler = (_req, res) => {
    // If you clear a cookie: res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
    return; // <— void return
  };

  /**
   * GET /api/auth/profile
   */
  static profile: RequestHandler = async (req, res) => {
    const userId = req.user!.id;
    const { rows } = await pool.query(
      `SELECT id, username, email, avatar_url, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return; // <— void return
    }
    res.json(rows[0]);
    return; // <— void return
  };
}
