// src/index.ts
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

import { initializeDatabase } from "./models";
import { StorageService } from "./services/storage.service";
import channelRoutes from "./routes/channel.routes";
import authRoutes from "./routes/auth.routes";
import videoRoutes from "./routes/video.routes";
import categoryRoutes from "./routes/category.routes";
import videoInteractions from "./routes/videoInteractions.routes";

// src/index.ts (or app.ts)
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT ?? 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/video/interactions", videoInteractions);
app.use("/api/channels", channelRoutes);
app.use("/api/categories", categoryRoutes);

async function initializeApp() {
  try {
    await initializeDatabase();
    console.log("Database initialized");

    await StorageService.ensureBucketExists();
    console.log("Storage bucket verified");

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Initialization failed:", error);
    process.exit(1);
  }
}

initializeApp();
