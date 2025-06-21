import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

// R2 uses 'auto' region & requires specific endpoint format
const REGION = process.env.R2_REGION || "auto";
const BUCKET = process.env.R2_BUCKET_NAME!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

const s3 = new S3Client({
  region: REGION,
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for R2 path-style URLs
});

export class StorageService {
  /** Upload a Multer‐buffered file, returns object key */
  static async uploadFile(file: Express.Multer.File): Promise<string> {
    const key = `uploads/${uuidv4()}-${file.originalname}`;
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // R2 doesn't use ACLs - remove ACL parameter entirely
    });
    await s3.send(cmd);
    return key;
  }

  /**
   * Upload from local file path
   * (R2 ignores ACLs - use custom domains for public access)
   */
  static async uploadFileFromPath(
    localPath: string,
    key: string,
    isPublic: boolean = false // Parameter retained for compatibility
  ): Promise<void> {
    const stats = fs.statSync(localPath);
    const stream = fs.createReadStream(localPath);

    stream.on("error", (err) => {
      console.error("File stream error:", err);
    });

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: this.getContentType(key),
      ContentLength: stats.size,
      // ACLs removed - use R2 public bucket or custom domain
    });

    await s3.send(cmd);
  }

  /**
   * Public URL requires custom domain or R2 public bucket.
   * Example with custom domain:
   */
  static getPublicUrl(key: string): string {
    // Using R2's public bucket URL pattern
    return `https://${BUCKET}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
    // OR with custom domain: return `https://media.example.com/${key}`;
  }

  /** Generate signed GET URL (works same as S3) */
  static async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    return presign(s3, cmd, { expiresIn });
  }

  /** Ensure bucket exists (simplified for R2) */
  static async ensureBucketExists(): Promise<void> {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      console.log(`Bucket "${BUCKET}" exists`);
    } catch (err: any) {
      if (err.name === "NotFound") {
        console.log(`Creating bucket "${BUCKET}"`);
        // R2 bucket creation doesn't require LocationConstraint
        await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
        await this.configureBucketCors();
      } else {
        throw err;
      }
    }
  }

  /** Apply CORS configuration (same as S3) */
  private static async configureBucketCors(): Promise<void> {
    const corsParams = {
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    };

    try {
      await s3.send(new PutBucketCorsCommand(corsParams));
      console.log("CORS configuration applied");
    } catch (err) {
      console.error("Failed to configure CORS:", err);
    }
  }

  /** Determine content type based on file extension */
  private static getContentType(key: string): string {
    const extension = key.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "m3u8":
        return "application/x-mpegURL";
      case "ts":
        return "video/MP2T";
      default:
        return "application/octet-stream";
    }
  }
}
