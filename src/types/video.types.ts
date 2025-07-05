import { Video as VideoType } from "../models/video.model";

export type Video = VideoType;
export interface VideoFilterParams {
  type?: "subscriptions" | "trending";
  category?: string;
  search?: string;
  userId?: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface VideoWithChannel extends Video {
  channel_name: string;
  channel_id: number;
}

export interface VideoListItem {
  id: number;
  title: string;
  thumbnail_key: string | null;
  duration: number | null;
  views: number;
  created_at: Date;
  channel_name: string;
  channel_avatar: string;
  channel_id: number;
}

export interface VideoView {
  id: number;
  user_id: number;
  video_id: number;
  created_at: Date;
  channel_name: string;
  channel_avatar: string;
  channel_id: number;
  title: string;
  thumbnail_key: string | null;
  duration: number | null;
  views: number;
}

export interface VideoInteraction {
  is_liked: boolean;
  is_saved: boolean;
}
