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
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            book_id: "book-1",
            chapter_id: "general",
            word: "word-1",
            next_review_at: "2026-01-01T00:00:00.000Z",
            last_reviewed_at: null,
            due_count: 0,
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
      newDueNow: 1,
      reviewDueNow: 0,
    });
    expect(backfillCall).toBeTruthy();
    expect(String(backfillCall[0])).toContain("DO UPDATE SET");
    expect(String(backfillCall[0])).toContain("last_reviewed_at IS NULL");
    expect(backfillCall[1]).toEqual([
      101,
      ["book-1"],
      ["general"],
      ["word-1"],
      expect.any(String),
    ]);
  });

  it("queues reviewed due words in addition to the new words per day limit", async () => {
    const words = Array.from({ length: 25 }, (_item, index) => ({
      word: `word-${index + 1}`,
      chapterId: "general",
      definitions: [`Definition ${index + 1}`],
    }));
    const reviewedRows = Array.from({ length: 3 }, (_item, index) => ({
      book_id: "book-1",
      chapter_id: "general",
      word: `word-${index + 1}`,
      next_review_at: "2026-01-01T00:00:00.000Z",
      last_reviewed_at: "2026-01-01T00:00:00.000Z",
      due_count: 2,
      updated_at: "2026-01-01T00:00:00.000Z",
    }));
    const newRows = Array.from({ length: 20 }, (_item, index) => ({
      book_id: "book-1",
      chapter_id: "general",
      word: `word-${index + 4}`,
      next_review_at: "2026-01-01T00:00:00.000Z",
      last_reviewed_at: null,
      due_count: 0,
      updated_at: "2026-01-01T00:00:00.000Z",
    }));

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
                    adaptiveReviewDailyLimit: 20,
                    words,
                  },
                ],
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: reviewedRows })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: newRows });

    const { reviewRouter } = await import("../routes/review.js");
    const app = createTestApp("/api/review", reviewRouter);

    const response = await request(app).get("/api/review/due?bookId=book-1&limit=20");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(23);
    expect(response.body.stats).toMatchObject({
      dueNow: 23,
      reviewDueNow: 3,
      newDueNow: 20,
      newWordsSeenToday: 0,
      newWordsRemainingToday: 20,
    });

    const newWordQueryCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes("last_reviewed_at IS NULL") && String(sql).includes("LIMIT $4")
    );
    expect(newWordQueryCall[1]).toEqual([101, expect.any(String), "book-1", 20]);
  });

  it("summarizes a large import as only the daily new word allowance due", async () => {
    const words = Array.from({ length: 1500 }, (_item, index) => ({
      word: `starter-${index + 1}`,
      chapterId: "general",
      definitions: [`Definition ${index + 1}`],
    }));
    const dueRows = words.map((wordEntry) => ({
      book_id: "book-1",
      chapter_id: "general",
      word: wordEntry.word,
      next_review_at: "2026-01-01T00:00:00.000Z",
      last_reviewed_at: null,
      due_count: 0,
      updated_at: "2026-01-01T00:00:00.000Z",
    }));

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            state_json: {
              data: {
                books: [
                  {
                    id: "book-1",
                    name: "Starter",
                    adaptiveReviewDailyLimit: 20,
                    words,
                  },
                ],
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: dueRows });

    const { reviewRouter } = await import("../routes/review.js");
    const app = createTestApp("/api/review", reviewRouter);

    const response = await request(app).get("/api/review/summary");

    expect(response.status).toBe(200);
    expect(response.body.stats.dueNow).toBe(20);
    expect(response.body.books[0]).toMatchObject({
      bookId: "book-1",
      totalWords: 1500,
      dueNow: 20,
      newDueNow: 20,
      reviewDueNow: 0,
      newWordsRemainingToday: 20,
    });
  });

  it("summarizes reviewed due words on top of the daily new word allowance", async () => {
    const words = Array.from({ length: 30 }, (_item, index) => ({
      word: `mixed-${index + 1}`,
      chapterId: "general",
      definitions: [`Definition ${index + 1}`],
    }));
    const dueRows = [
      ...Array.from({ length: 5 }, (_item, index) => ({
        book_id: "book-1",
        chapter_id: "general",
        word: `mixed-${index + 1}`,
        next_review_at: "2026-01-01T00:00:00.000Z",
        last_reviewed_at: "2026-01-01T00:00:00.000Z",
        due_count: 2,
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
      ...Array.from({ length: 25 }, (_item, index) => ({
        book_id: "book-1",
        chapter_id: "general",
        word: `mixed-${index + 6}`,
        next_review_at: "2026-01-01T00:00:00.000Z",
        last_reviewed_at: null,
        due_count: 0,
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    ];

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            state_json: {
              data: {
                books: [
                  {
                    id: "book-1",
                    name: "Mixed",
                    adaptiveReviewDailyLimit: 20,
                    words,
                  },
                ],
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: dueRows });

    const { reviewRouter } = await import("../routes/review.js");
    const app = createTestApp("/api/review", reviewRouter);

    const response = await request(app).get("/api/review/summary");

    expect(response.status).toBe(200);
    expect(response.body.books[0]).toMatchObject({
      bookId: "book-1",
      totalWords: 30,
      dueNow: 25,
      newDueNow: 20,
      reviewDueNow: 5,
    });
    expect(response.body.stats.dueNow).toBe(25);
  });
});
