import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();
const openAiMocks = vi.hoisted(() => ({
  defineEnglishWithOpenAI: vi.fn(),
  translateEnglishToJapaneseWithOpenAI: vi.fn(),
  translateJapaneseToEnglishWithOpenAI: vi.fn(),
}));

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

vi.mock("../lib/openaiTranslate.js", () => openAiMocks);

describe("vocabulary input validation", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    openAiMocks.defineEnglishWithOpenAI.mockReset();
    openAiMocks.translateEnglishToJapaneseWithOpenAI.mockReset();
    openAiMocks.translateJapaneseToEnglishWithOpenAI.mockReset();
    vi.stubGlobal("fetch", vi.fn());
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

  it("accepts romaji for Japanese to English lookup", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            is_common: true,
            japanese: [{ word: "黄色", reading: "きいろ" }],
            senses: [{ english_definitions: ["yellow"], parts_of_speech: ["Noun"] }],
          },
        ],
      }),
    });

    const { translateRouter } = await import("../routes/translate.js");
    const app = createTestApp("/api/translate", translateRouter);

    const response = await request(app).post("/api/translate/ja-en").send({
      text: "kiiro",
    });

    expect(response.status).toBe(200);
    expect(response.body.translations).toEqual(["yellow"]);
    expect(response.body.resolvedWord).toBe("黄色");
    expect(response.body.reading).toBe("きいろ");
  });

  it("prefers OpenAI over Jisho for romaji Japanese to English lookup", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            is_common: true,
            japanese: [{ word: "黄色", reading: "きいろ" }],
            senses: [{ english_definitions: ["yellow from jisho"], parts_of_speech: ["Noun"] }],
          },
        ],
      }),
    });
    openAiMocks.translateJapaneseToEnglishWithOpenAI.mockResolvedValue({
      english: "yellow",
      resolvedJapanese: "黄色",
      reading: "きいろ",
      confidence: "high",
      partOfSpeech: "noun",
      note: "",
    });

    const { translateRouter } = await import("../routes/translate.js");
    const app = createTestApp("/api/translate", translateRouter);

    const response = await request(app).post("/api/translate/ja-en").send({
      text: "kiiro",
    });

    expect(response.status).toBe(200);
    expect(response.body.translations).toEqual(["yellow"]);
    expect(response.body.provider).toBe("openai");
    expect(response.body.resolvedWord).toBe("黄色");
    expect(response.body.reading).toBe("きいろ");
    expect(openAiMocks.translateJapaneseToEnglishWithOpenAI).toHaveBeenCalledWith("kiiro");
  });

  it("uses OpenAI for romaji when Jisho has no result", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    openAiMocks.translateJapaneseToEnglishWithOpenAI.mockResolvedValue({
      english: "yellow",
      resolvedJapanese: "黄色",
      reading: "きいろ",
      confidence: "high",
      partOfSpeech: "noun",
      note: "",
    });

    const { translateRouter } = await import("../routes/translate.js");
    const app = createTestApp("/api/translate", translateRouter);

    const response = await request(app).post("/api/translate/ja-en").send({
      text: "kiiro",
    });

    expect(response.status).toBe(200);
    expect(response.body.translations).toEqual(["yellow"]);
    expect(response.body.provider).toBe("openai");
    expect(response.body.resolvedWord).toBe("黄色");
    expect(response.body.reading).toBe("きいろ");
    expect(openAiMocks.translateJapaneseToEnglishWithOpenAI).toHaveBeenCalledWith("kiiro");
  });
});
