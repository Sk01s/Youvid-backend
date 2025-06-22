// routes/comment.router.ts
import { Router } from "express";
import {
  getCommentsByVideo,
  createComment,
  toggleCommentLike,
  toggleCommentDislike,
  updateComment,
  deleteComment,
} from "../controllers/comment.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
// 1. Get all comments for a video
router.get("/video/:videoId", getCommentsByVideo);

// 2. Create a comment
router.post("/", createComment);

// 3. Toggle like
router.post("/:commentId/like", toggleCommentLike);

// 4. Toggle dislike
router.post("/:commentId/dislike", toggleCommentDislike);

// 5. Update comment
router.put("/:commentId", updateComment);

// 6. Delete comment
router.delete("/:commentId", deleteComment);

export default router;
