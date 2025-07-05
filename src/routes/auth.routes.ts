// routes/authRoutes.ts
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public
router.post("/login", AuthController.authenticate);
router.post("/logout", AuthController.logout);
router.get("/verify", AuthController.verify);

// Protected
router.get("/profile", authenticate, AuthController.profile);

export default router;
