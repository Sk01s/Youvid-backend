// routes/video.routes.ts
import { Router } from "express";
import { VideoController } from "../controllers/video.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public
router.get("/", VideoController.getVideos);

router.get("/:id", authenticate, VideoController.getVideo);

// Protected
router.get("/user", authenticate, VideoController.getUserVideos);
router.post("/upload", authenticate, VideoController.uploadVideo);

export default router;
