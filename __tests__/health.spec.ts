import request from "supertest";
import express, { Request, Response } from "express";

// minimal app for test
const app = express();
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

describe("GET /health", () => {
  it("returns 200 & status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
