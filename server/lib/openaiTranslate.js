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

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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
  const text = normalizeText(inputText);
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
          "You create Japanese vocabulary flashcards for English speakers. The input may be Japanese text or romaji. Return the most common learner-friendly English meaning for the given Japanese word or short expression. If the input is romaji, resolve it to one most likely everyday Japanese spelling and one kana reading. Do not combine alternatives with slashes or commas. Prefer everyday modern meanings. Avoid names, places, rare senses, archaic meanings, overly specific dictionary senses, and long explanations. If the input is ambiguous, choose the most common general meaning and mark confidence as medium or low.",
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
            resolvedJapanese: {
              type: "string",
              description:
                "One resolved Japanese spelling for the input. For romaji, return kana/kanji. For Japanese input, return the normalized Japanese word. Do not include alternate spellings. Empty string only if unknown.",
            },
            reading: {
              type: "string",
              description: "Kana reading if known. Empty string if not needed or unknown.",
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
          required: ["english", "resolvedJapanese", "reading", "confidence", "partOfSpeech", "note"],
        },
      },
    },
  });

  const parsed = parseResponseJson(response);
  const english = normalizeText(parsed?.english);

  if (!english) return null;

  return {
    english,
    resolvedJapanese: normalizeText(parsed?.resolvedJapanese),
    reading: normalizeText(parsed?.reading),
    confidence: normalizeConfidence(parsed?.confidence),
    partOfSpeech: normalizeText(parsed?.partOfSpeech) || "unknown",
    note: normalizeText(parsed?.note),
  };
}

export async function translateEnglishToJapaneseWithOpenAI(inputText) {
  const text = normalizeText(inputText);
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
          "You create Japanese vocabulary flashcards for English speakers. Given one English word or short expression, return the most common everyday Japanese translation for a learner. Prefer a concise modern translation. Avoid rare, archaic, overly technical, or name/place senses. If the English is ambiguous, choose the most common general meaning and mark confidence as medium or low.",
      },
      {
        role: "user",
        content: `English vocabulary item: ${text}`,
      },
    ],
    reasoning: {
      effort: "minimal",
    },
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "english_to_japanese_vocab_translation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            japanese: {
              type: "string",
              description: "One concise Japanese translation suitable for a vocabulary flashcard.",
            },
            reading: {
              type: "string",
              description: "Kana reading if known. Empty string if not needed or unknown.",
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
          required: ["japanese", "reading", "confidence", "partOfSpeech", "note"],
        },
      },
    },
  });

  const parsed = parseResponseJson(response);
  const japanese = normalizeText(parsed?.japanese);
  if (!japanese) return null;

  return {
    japanese,
    reading: normalizeText(parsed?.reading),
    confidence: normalizeConfidence(parsed?.confidence),
    partOfSpeech: normalizeText(parsed?.partOfSpeech) || "unknown",
    note: normalizeText(parsed?.note),
  };
}

export async function defineEnglishWithOpenAI(inputText) {
  const text = normalizeText(inputText);
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
          "You create English vocabulary flashcards for English speakers. Given one English word or short phrase, return a concise learner-friendly definition. Prefer common modern meanings. Avoid circular definitions, rare senses, and long explanations. Include one to three short definitions only when useful.",
      },
      {
        role: "user",
        content: `English vocabulary item: ${text}`,
      },
    ],
    reasoning: {
      effort: "minimal",
    },
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "english_vocab_definition",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            definitions: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
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
          required: ["definitions", "confidence", "partOfSpeech", "note"],
        },
      },
    },
  });

  const parsed = parseResponseJson(response);
  const definitions = Array.isArray(parsed?.definitions)
    ? parsed.definitions.map((definition) => normalizeText(definition)).filter(Boolean).slice(0, 3)
    : [];
  if (!definitions.length) return null;

  return {
    definitions,
    confidence: normalizeConfidence(parsed?.confidence),
    partOfSpeech: normalizeText(parsed?.partOfSpeech) || "unknown",
    note: normalizeText(parsed?.note),
  };
}
