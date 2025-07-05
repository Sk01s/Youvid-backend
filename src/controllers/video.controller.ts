import { Request, Response, RequestHandler } from "express";
import multer from "multer";

import { StorageService } from "../services/storage.service";
import { VideoProcessingService } from "../services/video-processing.service";
import { VideoRepository } from "../repositories/video.repository";
import {
  VideoFilterParams,
  PaginatedResult,
  VideoListItem,
  Video,
  VideoWithChannel,
  VideoInteraction,
  VideoView,
} from "../types/video.types";

const upload = multer({ storage: multer.memoryStorage() });
const repo = new VideoRepository();

export class VideoController {
  static uploadVideo: RequestHandler[] = [
    upload.single("video"),
    async (req: Request, res: Response): Promise<void> => {
      if (!req.file) {
        res.status(400).json({ message: "No video file provided" });
        return;
      }

      const userId = req.user!.id;
      const channel = await repo.getChannelByUserId(userId);
      if (!channel) {
        res.status(400).json({ message: "User does not have a channel" });
        return;
      }

      const fileKey = await StorageService.uploadFile(req.file);
      const { title, description, categoryId } = req.body;
      const video = await repo.createVideo({
        channelId: channel.id,
        categoryId: categoryId ? Number(categoryId) : null,
        title,
        description,
        originalFilename: fileKey,
        status: "uploading",
      });

      setImmediate(() => {
        VideoProcessingService.processVideoJob(video.id, req.file!, channel.id);
      });

      res.status(202).json({
        message: "Video is being processed",
        videoId: video.id,
        userId,
      });
    },
  ];

  static getVideo: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const video = await repo.getVideoById(id);
    if (!video) {
      res.status(404).json({ message: "Video not found" });
      return;
    }

    await repo.incrementVideoView(id, userId);

    const thumbnailUrl =
      video.thumbnail_key &&
      (await StorageService.getSignedUrl(video.thumbnail_key));

    const hlsUrl =
      video.processed_filename &&
      (await StorageService.getSignedUrl(
        `${video.processed_filename}/480p.m3u8`
      ));

    const interaction =
      (await repo.getVideoInteraction(userId, id)) ||
      ({ is_liked: false, is_saved: false } as VideoInteraction);

    res.json({
      ...video,
      thumbnailUrl,
      hlsUrl,
      isLiked: interaction.is_liked,
      isSaved: interaction.is_saved,
    });
  };

  static getVideos: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { type, category, search } = req.query as Record<string, string>;
    const userId = req.user?.id;

    const filter: VideoFilterParams = {
      type: type as "subscriptions" | "trending" | undefined,
      category,
      search,
      userId,
      limit,
      offset,
    };

    try {
      const result: PaginatedResult<VideoListItem> =
        await repo.getPaginatedVideos(filter);

      const data = await Promise.all(
        result.data.map(async (video) => ({
          ...video,
          thumbnailUrl:
            video.thumbnail_key &&
            (await StorageService.getSignedUrl(video.thumbnail_key, 3600)),
        }))
      );

      res.json({
        data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  };

  static getUserVideos: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.id;
    const videos: Video[] = await repo.getUserVideos(userId);

    const data = await Promise.all(
      videos.map(async (video) => ({
        ...video,
        thumbnailUrl:
          video.thumbnail_key &&
          (await StorageService.getSignedUrl(video.thumbnail_key)),
      }))
    );
    res.json(data);
  };

  static getUserViewedVideos: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
      const result: PaginatedResult<VideoView> = await repo.getUserViewedVideos(
        userId,
        limit,
        offset
      );

      const data = await Promise.all(
        result.data.map(async (video) => ({
          ...video,
          thumbnailUrl:
            video.thumbnail_key &&
            (await StorageService.getSignedUrl(video.thumbnail_key, 3600)),
        }))
      );

      res.json({
        data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch viewed videos:", error);
      res.status(500).json({ message: "Failed to fetch viewed videos" });
    }
  };

  static getLikedVideos: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
      const result: PaginatedResult<VideoView> = await repo.getLikedVideos(
        userId,
        limit,
        offset
      );

      const data = await Promise.all(
        result.data.map(async (video) => ({
          ...video,
          thumbnailUrl:
            video.thumbnail_key &&
            (await StorageService.getSignedUrl(video.thumbnail_key, 3600)),
        }))
      );

      res.json({
        data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch liked videos:", error);
      res.status(500).json({ message: "Failed to fetch liked videos" });
    }
  };

  static getSavedVideos: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
      const result: PaginatedResult<VideoView> = await repo.getSavedVideos(
        userId,
        limit,
        offset
      );

      const data = await Promise.all(
        result.data.map(async (video) => ({
          ...video,
          thumbnailUrl:
            video.thumbnail_key &&
            (await StorageService.getSignedUrl(video.thumbnail_key, 3600)),
        }))
      );

      res.json({
        data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch saved videos:", error);
      res.status(500).json({ message: "Failed to fetch saved videos" });
    }
  };

  static getChannelVideos: RequestHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const channelId = Number(req.params.channelId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
      const result: PaginatedResult<VideoListItem> =
        await repo.getChannelVideos(channelId, limit, offset);

      const data = await Promise.all(
        result.data.map(async (video) => ({
          ...video,
          thumbnailUrl:
            video.thumbnail_key &&
            (await StorageService.getSignedUrl(video.thumbnail_key, 3600)),
        }))
      );

      res.json({
        data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Failed to fetch channel videos:", error);
      res.status(500).json({ message: "Failed to fetch channel videos" });
    }
  };
}
