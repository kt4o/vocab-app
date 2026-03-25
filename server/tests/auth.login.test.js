import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();
const mockConnect = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
  pool: {
    connect: mockConnect,
  },
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockConnect.mockReset();
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
});
