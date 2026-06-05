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

function createStateWithWordCount(wordCount) {
  return {
    data: {
      books: [
        {
          id: "book-1",
          name: "Book 1",
          words: Array.from({ length: wordCount }, (_, index) => ({
            word: `word-${index + 1}`,
            chapterId: "general",
            definitions: [`Definition ${index + 1}`],
          })),
        },
      ],
    },
  };
}

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

  it("rejects free state saves that increase saved words above the free limit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ state_json: createStateWithWordCount(100) }] });
    const { stateRouter } = await import("../routes/state.js");
    const app = createTestApp("/api/state", stateRouter);

    const response = await request(app)
      .put("/api/state")
      .send({ appState: createStateWithWordCount(101) });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "free-word-limit-reached",
      limit: 100,
      wordCount: 101,
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockCreateSnapshot).not.toHaveBeenCalled();
  });
});
