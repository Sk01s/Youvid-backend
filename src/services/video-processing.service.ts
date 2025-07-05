import path from "path";
import fs from "fs";
import { StorageService } from "./storage.service";
import { FFmpegService } from "./ffmpeg.service";
import pool from "../db/pool";

export class VideoProcessingService {
  static async processVideoJob(
    videoId: number,
    file: Express.Multer.File,
    channelId: number
  ) {
    let tempDir = "";
    let hlsPath = "";

    try {
      tempDir = path.join(
        process.cwd(),
        "temp",
        channelId.toString(),
        videoId.toString()
      );
      fs.mkdirSync(tempDir, { recursive: true });

      const tempPath = path.join(tempDir, file.originalname);
      fs.writeFileSync(tempPath, file.buffer as any);

      const {
        hlsPath: processedPath,
        thumbnailPath,
        duration,
      } = await FFmpegService.processVideo(
        tempPath,
        channelId.toString(),
        videoId.toString()
      );

      hlsPath = processedPath;
      console.log(`Processing completed for video ${videoId}`);

      const processedFolder = `processed/${channelId}/${videoId}`;

      // Upload HLS files
      if (fs.existsSync(hlsPath)) {
        const files = fs.readdirSync(hlsPath);
        for (const file of files) {
          const filePath = path.join(hlsPath, file);
          if (fs.statSync(filePath).isFile()) {
            const s3Key = `${processedFolder}/${file}`;
            await StorageService.uploadFileFromPath(filePath, s3Key, true);
          }
        }
      } else {
        throw new Error(`HLS directory not found: ${hlsPath}`);
      }

      // Upload thumbnail
      if (fs.existsSync(thumbnailPath)) {
        const thumbKey = `${processedFolder}/thumbnail.jpg`;
        await StorageService.uploadFileFromPath(thumbnailPath, thumbKey);

        await pool.query(
          `UPDATE videos SET
            processed_filename = $1,
            thumbnail_key     = $2,
            duration          = $3,
            status            = $4
          WHERE id = $5`,
          [processedFolder, thumbKey, duration, "ready", videoId]
        );
      } else {
        console.warn(`Thumbnail not found: ${thumbnailPath}`);
        await pool.query(
          `UPDATE videos SET
            processed_filename = $1,
            duration          = $2,
            status            = $3
          WHERE id = $4`,
          [processedFolder, duration, "ready", videoId]
        );
      }
    } catch (err) {
      console.error("Video processing failed:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      await pool.query(
        `UPDATE videos SET status = 'failed', error_message = $2 WHERE id = $1`,
        [videoId, errorMessage]
      );
    } finally {
      // Cleanup temp files
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      if (hlsPath && fs.existsSync(hlsPath)) {
        fs.rmSync(hlsPath, { recursive: true, force: true });
      }
    }
  }
}
