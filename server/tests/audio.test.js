import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const openAiMocks = vi.hoisted(() => ({
  generateSpeechAudioWithOpenAI: vi.fn(),
}));

vi.mock("../lib/openaiTranslate.js", () => openAiMocks);

describe("audio route", () => {
  beforeEach(() => {
    openAiMocks.generateSpeechAudioWithOpenAI.mockReset();
  });

  it("returns generated speech audio", async () => {
    openAiMocks.generateSpeechAudioWithOpenAI.mockResolvedValue(Buffer.from("mp3-data"));

    const { audioRouter } = await import("../routes/audio.js");
    const app = createTestApp("/api/audio", audioRouter);

    const response = await request(app).post("/api/audio/speech").send({
      text: "こんにちは",
      language: "ja-JP",
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/mpeg");
    expect(Buffer.from(response.body).toString()).toBe("mp3-data");
    expect(openAiMocks.generateSpeechAudioWithOpenAI).toHaveBeenCalledWith({
      text: "こんにちは",
      language: "ja-JP",
    });
  });

  it("rejects missing text", async () => {
    const { audioRouter } = await import("../routes/audio.js");
    const app = createTestApp("/api/audio", audioRouter);

    const response = await request(app).post("/api/audio/speech").send({
      language: "en-US",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "audio-text-required" });
    expect(openAiMocks.generateSpeechAudioWithOpenAI).not.toHaveBeenCalled();
  });
});
