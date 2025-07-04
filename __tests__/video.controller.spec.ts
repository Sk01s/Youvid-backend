import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const mkdtemp = promisify(fs.mkdtemp);
const writeFile = promisify(fs.writeFile);
const rm = promisify(fs.rm);

import pool from "../src/models";
import { StorageService } from "../src/services/storage.service";
import { FFmpegService } from "../src/services/ffmpeg.service";
import {
  VideoController,
  incrementVideoView,
} from "../src/controllers/video.controller";
// Mock external modules
jest.mock("../src/models");
jest.mock("../src/services/storage.service");
jest.mock("../src/services/ffmpeg.service");
jest.mock("../src/controllers/video.controller", () => ({
  incrementVideoView: jest.fn().mockResolvedValue(undefined),
}));

describe("VideoController", () => {
  let app: express.Express;
  let tempHlsDir: string;
  let tempThumbPath: string;

  // Stub authentication middleware: set user.id = 1
  function authStub(req: Request, _res: Response, next: NextFunction) {
    req.user = { id: 1 } as any;
    next();
  }

  beforeAll(async () => {
    // Create temp directories
    tempHlsDir = await mkdtemp(path.join(__dirname, "test-hls-"));
    tempThumbPath = path.join(__dirname, "test-thumb.jpg");

    // Create test files
    await writeFile(path.join(tempHlsDir, "480p.m3u8"), "#EXTM3U\n...");
    await writeFile(tempThumbPath, "thumbnail-data");

    // Update FFmpegService mock
    (FFmpegService.processVideo as jest.Mock).mockResolvedValue({
      hlsPath: tempHlsDir,
      thumbnailPath: tempThumbPath,
      duration: 15,
    });
  });

  afterAll(async () => {
    // Cleanup temp directories
    await rm(tempHlsDir, { recursive: true, force: true });
    await rm(tempThumbPath, { force: true });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    app = express();
    app.use(express.json());
    app.use(authStub);

    // Mount routes under test
    app.post("/upload", VideoController.uploadVideo as any);
    app.get("/video/:id", VideoController.getVideo);
  });

  describe("POST /upload", () => {
    it("should return 400 if no file provided", async () => {
      const res = await request(app).post("/upload");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "No video file provided" });
    });

    it("should return 400 if user has no channel", async () => {
      // Channel lookup returns empty
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/upload")
        .attach("video", Buffer.from("test"), "video.mp4");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "User does not have a channel" });
    });

    it("should insert video and return 202 with userId", async () => {
      // 1. Channel lookup
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 42 }] })
        // 2. Video INSERT
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });

      // Mock StorageService and FFmpegService
      (StorageService.uploadFile as jest.Mock).mockResolvedValue("orig-key");

      const res = await request(app)
        .post("/upload")
        .field("title", "Test Title")
        .field("description", "Test Desc")
        .field("categoryId", "7")
        .attach("video", Buffer.from("testdata"), "video.mp4");

      expect(res.status).toBe(202);
      expect(res.body).toEqual({
        message: "Video is being processed",
        videoId: 99,
        userId: 1,
      });

      // Verify calls
      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("SELECT id FROM channels"),
        [1]
      );
      expect(StorageService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ originalname: "video.mp4" })
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO videos"),
        expect.arrayContaining([
          42,
          "7",
          "Test Title",
          "Test Desc",
          "orig-key",
          "uploading",
        ])
      );
    });
  });

  describe("GET /video/:id", () => {
    it("should return 404 if video not found", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/video/55");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Video not found" });
    });

    it("should return video payload when found", async () => {
      const fakeRow = {
        id: 14,
        title: "MyVid",
        description: "Desc",
        channel_id: 5,
        channel_name: "Chan",
        processed_filename: "proc/5/10",
        thumbnail_key: "proc/5/10/thumb.jpg",
        duration: 20,
        views: 100,
        created_at: new Date(),
      };

      // 1. video select
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [fakeRow] })
        // 2. interaction select
        .mockResolvedValueOnce({ rows: [] }); // No interaction

      // Mock StorageService URLs
      (StorageService.getSignedUrl as jest.Mock)
        .mockResolvedValueOnce("https://cdn/thumb.jpg")
        .mockResolvedValueOnce("https://cdn/480p.m3u8");

      const res = await request(app).get("/video/14");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 14,
        title: "MyVid",
        channel_name: "Chan",
        thumbnailUrl: "https://cdn/thumb.jpg",
        hlsUrl: "https://cdn/480p.m3u8",
        isLiked: false,
        isSaved: false,
      });
    });
  });
});
