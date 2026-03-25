import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createWriteRateLimitMiddleware } from "../middleware/writeRateLimit.js";

describe("write rate limit middleware", () => {
  it("returns 429 when write threshold is exceeded", async () => {
    const consumeWriteRateLimit = vi.fn().mockResolvedValue({
      isAllowed: false,
      retryAfterSeconds: 42,
    });
    const getRequesterKey = vi.fn().mockReturnValue("127.0.0.1");

    const app = express();
    app.use(
      createWriteRateLimitMiddleware({
        consumeWriteRateLimit,
        getRequesterKey,
        windowMs: 900000,
        maxAttempts: 1,
      })
    );
    app.post("/write", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).post("/write").send({});

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate-limited", retryAfterSeconds: 42 });
    expect(consumeWriteRateLimit).toHaveBeenCalledTimes(1);
  });
});

