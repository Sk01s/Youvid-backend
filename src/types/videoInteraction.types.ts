// types/videoInteraction.types.ts
import type { VideoInteraction as VideoInteractionType } from "../models/videoInteraction.model";
export type VideoInteraction = VideoInteractionType;
export interface VideoInteractionStatus {
  isLiked: boolean;
  isSaved: boolean;
}
