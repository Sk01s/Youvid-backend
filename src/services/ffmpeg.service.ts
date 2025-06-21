import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";

// Point fluent-ffmpeg at the static binaries
ffmpeg.setFfmpegPath(ffmpegStatic as string);
ffmpeg.setFfprobePath(ffprobeStatic.path);

export class FFmpegService {
  static async processVideo(
    inputPath: string,
    channelId: string,
    videoId: string
  ): Promise<{
    hlsPath: string;
    thumbnailPath: string;
    duration: number;
  }> {
    const outputDir = path.join(process.cwd(), "processed", channelId, videoId);
    fs.mkdirSync(outputDir, { recursive: true });

    const duration = await this.getVideoDuration(inputPath);

    // 1) create the variant playlists
    await this.createHlsVariants(inputPath, outputDir);

    // 2) generate the master playlist
    await this.generateMasterPlaylist(outputDir);

    // 3) generate the thumbnail
    const thumbnailPath = path.join(outputDir, "thumbnail.jpg");
    await this.generateThumbnail(inputPath, thumbnailPath);

    return {
      hlsPath: outputDir,
      thumbnailPath,
      duration,
    };
  }

  private static async getVideoDuration(inputPath: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        const d = metadata.format.duration;
        resolve(typeof d === "number" && !isNaN(d) ? d : 0);
      });
    });
  }

  private static createHlsVariants(
    inputPath: string,
    outputDir: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        // video + audio codecs and fragment settings
        .addOutputOptions([
          "-c:v libx264",
          "-profile:v baseline",
          "-level 3.0",
          "-c:a aac",
          "-b:a 128k",
          "-start_number 0",
          "-hls_time 10",
          "-hls_list_size 0",
          "-f hls",
        ])
        // 720p
        .output(path.join(outputDir, "720p.m3u8"))
        .addOutputOptions(["-s 1280x720", "-b:v 2800k"])
        // 480p
        .output(path.join(outputDir, "480p.m3u8"))
        .addOutputOptions(["-s 854x480", "-b:v 1400k"])
        // 360p
        .output(path.join(outputDir, "360p.m3u8"))
        .addOutputOptions(["-s 640x360", "-b:v 800k"])
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });
  }

  private static async generateMasterPlaylist(
    outputDir: string
  ): Promise<void> {
    const masterPath = path.join(outputDir, "master.m3u8");
    const lines = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "",
      "# 720p",
      '#EXT-X-STREAM-INF:BANDWIDTH=3200000,RESOLUTION=1280x720,CODECS="avc1.42e01e,mp4a.40.2"',
      "720p.m3u8",
      "",
      "# 480p",
      '#EXT-X-STREAM-INF:BANDWIDTH=1600000,RESOLUTION=854x480,CODECS="avc1.42e01e,mp4a.40.2"',
      "480p.m3u8",
      "",
      "# 360p",
      '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,CODECS="avc1.42e01e,mp4a.40.2"',
      "360p.m3u8",
      "",
    ];
    fs.writeFileSync(masterPath, lines.join("\n"), "utf8");
  }

  private static generateThumbnail(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise<void>(async (resolve) => {
      try {
        // Try 50% duration
        await this.tryGenerateThumbnail(inputPath, outputPath, "50%");
        if (fs.existsSync(outputPath)) return resolve();

        // Fallback to first frame
        await this.tryGenerateThumbnail(inputPath, outputPath, "00:00:00.001");
        if (fs.existsSync(outputPath)) return resolve();

        // Final: blank
        this.createBlankThumbnail(outputPath);
        resolve();
      } catch {
        this.createBlankThumbnail(outputPath);
        resolve();
      }
    });
  }

  private static tryGenerateThumbnail(
    inputPath: string,
    outputPath: string,
    timestamp: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: "640x360",
        })
        .on("end", () =>
          setTimeout(
            () =>
              fs.existsSync(outputPath)
                ? resolve()
                : reject(new Error("No thumbnail")),
            500
          )
        )
        .on("error", reject);
    });
  }

  private static createBlankThumbnail(outputPath: string): void {
    const canvas = createCanvas(640, 360);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = "#fff";
    ctx.font = "30px Sans";
    ctx.textAlign = "center";
    ctx.fillText("Thumbnail Not Available", 320, 180);
    const out = fs.createWriteStream(outputPath);
    canvas.createJPEGStream().pipe(out);
  }
}
