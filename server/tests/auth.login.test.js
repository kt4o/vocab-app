import request from "supertest";
import crypto from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();
const mockConnect = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
  pool: {
    connect: mockConnect,
  },
}));

const ORIGINAL_ENV = { ...process.env };

function createPasswordHashForTest(password, salt = "testsaltvalue1234") {
  const digest = crypto.pbkdf2Sync(password, salt, 120_000, 64, "sha512").toString("hex");
  return `${salt}:${digest}`;
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockConnect.mockReset();
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects bad credentials", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { authRouter } = await import("../routes/auth.js");
    const app = createTestApp("/api/auth", authRouter);

    const response = await request(app).post("/api/auth/login").send({
      identifier: "nobody@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid-credentials" });
  });

  it("defaults to SameSite=None cookies in production when not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_SAMESITE;

    const password = "strong-password-123";
    const passwordHash = createPasswordHashForTest(password);

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 42, username: "alice_123", password_hash: passwordHash }],
      })
      .mockResolvedValue({ rows: [] });

    const { authRouter } = await import("../routes/auth.js");
    const app = createTestApp("/api/auth", authRouter);

    const response = await request(app).post("/api/auth/login").send({
      identifier: "alice_123",
      password,
    });

    expect(response.status).toBe(200);
    const sessionCookie = String(response.headers["set-cookie"]?.[0] || "");
    expect(sessionCookie).toContain("SameSite=None");
    expect(sessionCookie).toContain("Secure");
  });
});
