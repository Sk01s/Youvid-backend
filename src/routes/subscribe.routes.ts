import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getSubscriptionStatusController,
  toggleSubscriptionController,
} from "../controllers/subscribe.controller";

const router = express.Router();

// Get subscription status
router.get(
  "/channels/:channelId/subscription",
  // ensureAuth middleware should set req.user
  getSubscriptionStatusController
);

// require login
router.post(
  "/:channelId/subscription",
  // ensureAuth middleware should set req.user
  toggleSubscriptionController
);

export default router;
