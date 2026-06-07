import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.authUser = { id: 101, username: "tester", plan: "free" };
    next();
  },
}));

describe("GET /api/review/summary", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("backfills saved words into adaptive review as due", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            state_json: {
              data: {
                books: [
                  {
                    id: "book-1",
                    name: "Book 1",
                    words: [
                      {
                        word: "word-1",
                        chapterId: "general",
                        definitions: ["Definition 1"],
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            book_id: "book-1",
            chapter_id: "general",
            word: "word-1",
            next_review_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

    const { reviewRouter } = await import("../routes/review.js");
    const app = createTestApp("/api/review", reviewRouter);

    const response = await request(app).get("/api/review/summary");
    const backfillCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO word_review_state")
    );

    expect(response.status).toBe(200);
    expect(response.body.stats.dueNow).toBe(1);
    expect(response.body.books[0]).toMatchObject({
      bookId: "book-1",
      bookName: "Book 1",
      totalWords: 1,
      dueNow: 1,
    });
    expect(backfillCall).toBeTruthy();
    expect(backfillCall[1]).toEqual([
      101,
      ["book-1"],
      ["general"],
      ["word-1"],
      expect.any(String),
    ]);
  });
});
