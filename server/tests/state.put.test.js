import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();
const mockCreateSnapshot = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.authUser = { id: 101, username: "tester", plan: "free" };
    next();
  },
}));

vi.mock("../lib/snapshots.js", () => ({
  createUserSnapshot: mockCreateSnapshot,
  listUserSnapshots: vi.fn(),
  restoreUserSnapshot: vi.fn(),
}));

describe("PUT /api/state", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockCreateSnapshot.mockReset();
  });

  it("rejects invalid appState payload", async () => {
    const { stateRouter } = await import("../routes/state.js");
    const app = createTestApp("/api/state", stateRouter);

    const response = await request(app).put("/api/state").send({ appState: null });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid-app-state" });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockCreateSnapshot).not.toHaveBeenCalled();
  });
});
