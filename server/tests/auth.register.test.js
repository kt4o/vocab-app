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

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockConnect.mockReset();
  });

  it("requires a verified email token", async () => {
    const { authRouter } = await import("../routes/auth.js");
    const app = createTestApp("/api/auth", authRouter);

    const response = await request(app).post("/api/auth/register").send({
      email: "alice@example.com",
      username: "alice_123",
      password: "strong-password-123",
      acceptedLegal: true,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email-not-verified" });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
