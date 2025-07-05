// controllers/auth.controller.ts
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRepository } from "../repositories/auth.repository";
import { AuthResult, UserProfile } from "../types/auth.types";

const authRepo = new AuthRepository();

export class AuthController {
  /**
   * POST /api/auth/login
   * Body: { email, password, username? }
   */
  static authenticate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, username } = req.body;
      const { user, token }: AuthResult<any> = await AuthService.authenticate(
        email,
        password,
        username
      );

      // strip password before returning
      const { password: _, ...userData } = user;
      res.json({ user: userData, token });
    } catch (err: any) {
      if (err.message === "Invalid credentials") {
        res.status(401).json({ message: err.message });
      } else if (err.message.includes("Username")) {
        res
          .status(400)
          .json({ message: "Username is required to register a new user" });
      } else {
        console.error("Authentication error:", err);
        res.status(500).json({ message: "Authentication failed" });
      }
    }
  };

  /**
   * GET /api/auth/authenticate
   */
  static verify = async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = AuthService.verifyToken(token);
      res.status(200).json({ id: decoded.id, username: decoded.username });
    } catch (err) {
      console.error("Token verification failed:", err);
      res.status(401).json({ message: "Invalid or expired token" });
    }
  };

  /**
   * POST /api/auth/logout
   */
  static logout = (_req: Request, res: Response): void => {
    // Optionally clear cookie: res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  };

  /**
   * GET /api/auth/profile
   */
  static profile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    try {
      const profile = await authRepo.findUserProfileById(userId);
      if (!profile) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json(profile);
    } catch (err) {
      console.error("Error fetching profile:", err);
      res.status(500).json({ message: "Server error" });
    }
  };
}
