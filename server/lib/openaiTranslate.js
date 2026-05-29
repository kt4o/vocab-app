import OpenAI from "openai";

const DEFAULT_OPENAI_TRANSLATION_MODEL = "gpt-5-mini";

let openAiClient = null;

function getOpenAiClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey });
  }
  return openAiClient;
}

function isOpenAiTranslationEnabled() {
  return String(process.env.OPENAI_TRANSLATION_ENABLED || "true").trim().toLowerCase() !== "false";
}

function normalizeConfidence(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "high" || normalized === "medium" || normalized === "low"
    ? normalized
    : "medium";
}

function parseResponseJson(response) {
  const outputText = String(response?.output_text || "").trim();
  if (outputText) {
    return JSON.parse(outputText);
  }

  const textParts = [];
  const output = Array.isArray(response?.output) ? response.output : [];
  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (typeof part?.text === "string") textParts.push(part.text);
    });
  });

  return JSON.parse(textParts.join("").trim());
}

export async function translateJapaneseToEnglishWithOpenAI(inputText) {
  const text = String(inputText || "").trim();
  if (!text || !isOpenAiTranslationEnabled()) return null;

  const client = getOpenAiClient();
  if (!client) return null;

  const response = await client.responses.create({
    model: String(process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_OPENAI_TRANSLATION_MODEL).trim() ||
      DEFAULT_OPENAI_TRANSLATION_MODEL,
    input: [
      {
        role: "system",
        content:
          "You create Japanese vocabulary flashcards for English speakers. Return the most common learner-friendly English meaning for the given Japanese word or short expression. Prefer everyday modern meanings. Avoid names, places, rare senses, archaic meanings, overly specific dictionary senses, and long explanations. If the input is ambiguous, choose the most common general meaning and mark confidence as medium or low.",
      },
      {
        role: "user",
        content: `Japanese vocabulary item: ${text}`,
      },
    ],
    reasoning: {
      effort: "minimal",
    },
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "japanese_vocab_translation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            english: {
              type: "string",
              description: "One concise English meaning suitable for a vocabulary flashcard.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            partOfSpeech: {
              type: "string",
              description: "A short part of speech label, or unknown.",
            },
            note: {
              type: "string",
              description: "A short learner note. Empty string if not needed.",
            },
          },
          required: ["english", "confidence", "partOfSpeech", "note"],
        },
      },
    },
  });

  const parsed = parseResponseJson(response);
  const english = String(parsed?.english || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!english) return null;

  return {
    english,
    confidence: normalizeConfidence(parsed?.confidence),
    partOfSpeech: String(parsed?.partOfSpeech || "unknown").replace(/\s+/g, " ").trim() || "unknown",
    note: String(parsed?.note || "").replace(/\s+/g, " ").trim(),
  };
}
