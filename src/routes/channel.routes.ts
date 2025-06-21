// routes/channel.routes.ts
import { Router } from "express";
import { ChannelController } from "../controllers/channel.controller";
import { authenticate } from "../middleware/auth.middleware";
import subscribeHistory from "./subscribe.routes";
const router = Router();

router.get(
  "/user/:userId",
  authenticate,
  ChannelController.getChannelsByUserId
);
router.use("/", authenticate, subscribeHistory);

router.get("/:id", ChannelController.getChannelById);

router.post("/", ChannelController.createChannel);

router.put("/:id", ChannelController.updateChannel);

export default router;
