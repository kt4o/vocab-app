import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const openAiMocks = vi.hoisted(() => ({
  generateExampleSentenceWithOpenAI: vi.fn(),
}));

vi.mock("../lib/openaiTranslate.js", () => openAiMocks);

describe("example sentence route", () => {
  beforeEach(() => {
    openAiMocks.generateExampleSentenceWithOpenAI.mockReset();
  });

  it("returns an AI-generated example sentence", async () => {
    openAiMocks.generateExampleSentenceWithOpenAI.mockResolvedValue({
      sentence: "彼女は毎朝りんごを食べます。",
      translation: "She eats an apple every morning.",
      provider: "openai",
    });

    const { examplesRouter } = await import("../routes/examples.js");
    const app = createTestApp("/api/examples", examplesRouter);

    const response = await request(app).post("/api/examples/sentence").send({
      word: "apple",
      definitions: ["りんご"],
      languageMode: "en_ja",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sentence: "彼女は毎朝りんごを食べます。",
      translation: "She eats an apple every morning.",
      provider: "openai",
    });
    expect(openAiMocks.generateExampleSentenceWithOpenAI).toHaveBeenCalledWith({
      word: "apple",
      definitions: ["りんご"],
      languageMode: "en_ja",
    });
  });

  it("rejects missing words", async () => {
    const { examplesRouter } = await import("../routes/examples.js");
    const app = createTestApp("/api/examples", examplesRouter);

    const response = await request(app).post("/api/examples/sentence").send({
      definitions: ["definition"],
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "example-word-required" });
    expect(openAiMocks.generateExampleSentenceWithOpenAI).not.toHaveBeenCalled();
  });

  it("reports when the example provider is unavailable", async () => {
    openAiMocks.generateExampleSentenceWithOpenAI.mockResolvedValue(null);

    const { examplesRouter } = await import("../routes/examples.js");
    const app = createTestApp("/api/examples", examplesRouter);

    const response = await request(app).post("/api/examples/sentence").send({
      word: "brisk",
      definitions: ["quick and energetic"],
      languageMode: "en_en",
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "example-provider-unavailable" });
  });
});
