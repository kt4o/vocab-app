import { Router } from "express";
import { generateSpeechAudioWithOpenAI } from "../lib/openaiTranslate.js";

export const audioRouter = Router();

const AUDIO_TEXT_MAX_LENGTH = 260;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLanguage(value) {
  const normalized = String(value || "").trim();
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(normalized)) return normalized;
  return "";
}

audioRouter.post("/speech", async (req, res) => {
  const text = normalizeText(req.body?.text);
  if (!text) {
    res.status(400).json({ error: "audio-text-required" });
    return;
  }

  if (text.length > AUDIO_TEXT_MAX_LENGTH) {
    res.status(400).json({ error: "audio-text-too-long" });
    return;
  }

  try {
    const audioBuffer = await generateSpeechAudioWithOpenAI({
      text,
      language: normalizeLanguage(req.body?.language),
    });

    if (!audioBuffer?.length) {
      res.status(503).json({ error: "audio-provider-unavailable" });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(audioBuffer);
  } catch (error) {
    console.error("Speech audio generation failed", error);
    res.status(502).json({ error: "audio-provider-failed" });
  }
});
