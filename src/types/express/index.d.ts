// src/types/express/index.d.ts
import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username?: string;
      } & JwtPayload;
    }
  }
}
