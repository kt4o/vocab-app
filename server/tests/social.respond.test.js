import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.authUser = { id: 99, username: "outsider", plan: "free" };
    next();
  },
}));

describe("POST /api/social/requests/:id/respond", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("blocks callers who are not participants on the request", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 321,
          user_low_id: 10,
          user_high_id: 11,
          requested_by: 10,
          status: "pending",
        },
      ],
    });

    const { socialRouter } = await import("../routes/social.js");
    const app = createTestApp("/api/social", socialRouter);

    const response = await request(app)
      .post("/api/social/requests/321/respond")
      .send({ action: "accept" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "not-request-participant" });
  });
});
