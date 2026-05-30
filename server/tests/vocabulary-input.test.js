import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

vi.mock("../lib/openaiTranslate.js", () => ({
  defineEnglishWithOpenAI: vi.fn(),
  translateEnglishToJapaneseWithOpenAI: vi.fn(),
  translateJapaneseToEnglishWithOpenAI: vi.fn(),
}));

describe("vocabulary input validation", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects long English sentences before definition lookup", async () => {
    const { defineRouter } = await import("../routes/define.js");
    const app = createTestApp("/api/define", defineRouter);

    const response = await request(app).post("/api/define/en").send({
      word: "this is a long sentence",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid-english-word" });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects long English sentences before translation lookup", async () => {
    const { translateRouter } = await import("../routes/translate.js");
    const app = createTestApp("/api/translate", translateRouter);

    const response = await request(app).post("/api/translate/en-ja").send({
      text: "this is a long sentence",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid-vocabulary-item" });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects Japanese sentences before translation lookup", async () => {
    const { translateRouter } = await import("../routes/translate.js");
    const app = createTestApp("/api/translate", translateRouter);

    const response = await request(app).post("/api/translate/ja-en").send({
      text: "これは長い文です。",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid-vocabulary-item" });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
