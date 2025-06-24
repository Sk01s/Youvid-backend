// routes/video.routes.ts
import { Router } from "express";
import { VideoController } from "../controllers/video.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, VideoController.getVideos);

router.get("/user", authenticate, VideoController.getUserVideos);

router.get("/user/viewed", authenticate, VideoController.getUserViewedVideos);

router.get("/user/liked", authenticate, VideoController.getLikedVideos);

router.get("/user/saved", authenticate, VideoController.getSavedVideos);

router.get(
  "/channel/:channelId",
  authenticate,
  VideoController.getChannelVideos
);

router.post("/upload", authenticate, VideoController.uploadVideo);

router.get("/:id", authenticate, VideoController.getVideo);

export default router;
