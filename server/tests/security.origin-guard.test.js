import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createCookieOriginGuard } from "../middleware/originGuard.js";

describe("cookie origin guard", () => {
  it("rejects cookie-authenticated write requests from invalid origins", async () => {
    const app = express();
    const allowedOrigins = new Set(["https://app.example.com"]);
    app.use(
      createCookieOriginGuard({
        allowedOrigins,
        sessionCookieName: "vocab_session",
      })
    );
    app.post("/write", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .post("/write")
      .set("cookie", "vocab_session=abc123")
      .set("origin", "https://evil.example.com")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "invalid-origin" });
  });
});

