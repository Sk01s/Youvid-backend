// src/middleware/auth.middleware.ts
import { RequestHandler } from "express";
import { AuthService } from "../services/auth.service";

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = AuthService.verifyToken(token);
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
};
