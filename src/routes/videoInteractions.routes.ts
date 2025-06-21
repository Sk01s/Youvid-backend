// In your routes file
import { Router } from "express";
import { VideoInteractionController } from "../controllers/videoInteractions.controller";
import { authenticate } from "../middleware/auth.middleware";
const router = Router();

router.put("/:id/like", authenticate, VideoInteractionController.toggleLike);
router.put("/:id/save", authenticate, VideoInteractionController.toggleSave);
router.get("/", authenticate, VideoInteractionController.getUserInteractions);

export default router;
