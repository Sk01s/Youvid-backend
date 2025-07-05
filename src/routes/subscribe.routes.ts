import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { SubscriptionController } from "../controllers/subscribe.controller";

const router = express.Router();

// Get subscription status
router.get(
  "/:channelId/subscription",
  // ensureAuth middleware should set req.user
  SubscriptionController.getStatus
);

// require login
router.post(
  "/:channelId/subscription",
  // ensureAuth middleware should set req.user
  SubscriptionController.toggle
);

export default router;
