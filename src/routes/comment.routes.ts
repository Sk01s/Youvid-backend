// routes/comment.router.ts
import { Router } from "express";
import { CommentController } from "../controllers/comment.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
// 1. Get all comments for a video
router.get("/video/:videoId", CommentController.getByVideo);

// 2. Create a comment
router.post("/", CommentController.create);

// 3. Toggle like
router.post("/:commentId/like", CommentController.toggleLike);

// 4. Toggle dislike
router.post("/:commentId/dislike", CommentController.toggleDislike);

// 5. Update comment
router.put("/:commentId", CommentController.update);

// 6. Delete comment
router.delete("/:commentId", CommentController.delete);

export default router;
