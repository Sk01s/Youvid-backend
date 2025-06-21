// routes/authRoutes.ts
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public
router.post("/authenticate", AuthController.authenticate);
router.post("/logout", AuthController.logout);

// Protected
router.get("/profile", authenticate, AuthController.profile);

export default router;
