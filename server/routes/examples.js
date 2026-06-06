import { Router } from "express";
import { generateExampleSentenceWithOpenAI } from "../lib/openaiTranslate.js";

export const examplesRouter = Router();

const EXAMPLE_INPUT_MAX_LENGTH = 64;
const EXAMPLE_DEFINITION_MAX_LENGTH = 180;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLanguageMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "en_ja" || normalized === "ja_en" || normalized === "en_en"
    ? normalized
    : "en_en";
}

function normalizeDefinitions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((definition) => normalizeText(definition).slice(0, EXAMPLE_DEFINITION_MAX_LENGTH))
    .filter(Boolean)
    .slice(0, 3);
}

examplesRouter.post("/sentence", async (req, res) => {
  const word = normalizeText(req.body?.word);
  if (!word) {
    res.status(400).json({ error: "example-word-required" });
    return;
  }
  if (word.length > EXAMPLE_INPUT_MAX_LENGTH) {
    res.status(400).json({ error: "invalid-example-word" });
    return;
  }

  try {
    const example = await generateExampleSentenceWithOpenAI({
      word,
      definitions: normalizeDefinitions(req.body?.definitions),
      languageMode: normalizeLanguageMode(req.body?.languageMode),
    });

    if (!example?.sentence) {
      res.status(503).json({ error: "example-provider-unavailable" });
      return;
    }

    res.json({
      sentence: example.sentence,
      translation: example.translation || "",
      provider: example.provider || "openai",
    });
  } catch (error) {
    console.error("Example sentence generation failed", error);
    res.status(502).json({ error: "example-provider-failed" });
  }
});
