import OpenAI from "openai";

const DEFAULT_OPENAI_TRANSLATION_MODEL = "gpt-5-mini";
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_TTS_VOICE = "marin";

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

function isOpenAiTtsEnabled() {
  return String(process.env.OPENAI_TTS_ENABLED || "true").trim().toLowerCase() !== "false";
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

function stripInlineJapaneseReadings(value) {
  return normalizeText(
    String(value || "").replace(/([\u3400-\u9fff々〆ヶ]+)[(（]([\u3040-\u30ffー\s]+)[)）]/g, "$1")
  );
}

function getInlineJapaneseReadingSegments(value) {
  const text = String(value || "");
  const segments = [];
  const pattern = /([\u3400-\u9fff々〆ヶ]+)[(（]([\u3040-\u30ffー\s]+)[)）]/g;
  let match = pattern.exec(text);

  while (match) {
    const surface = normalizeText(match[1]);
    const reading = String(match[2] || "").replace(/\s+/g, "").trim();
    if (surface && reading) {
      segments.push({ text: surface, reading });
    }
    match = pattern.exec(text);
  }

  return segments;
}

function hasKanjiText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function toReadingHiragana(value) {
  return String(value || "").replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x30a1 + 0x3041)
  );
}

function trimReadingAffix(reading, affix, side) {
  const normalizedReading = toReadingHiragana(reading).replace(/\s+/g, "");
  const normalizedAffix = toReadingHiragana(affix).replace(/\s+/g, "");
  if (!normalizedReading || !normalizedAffix) return normalizedReading;
  if (side === "start" && normalizedReading.startsWith(normalizedAffix)) {
    return normalizedReading.slice(normalizedAffix.length);
  }
  if (side === "end" && normalizedReading.endsWith(normalizedAffix)) {
    return normalizedReading.slice(0, -normalizedAffix.length);
  }
  return normalizedReading;
}

function limitFuriganaSegmentToKanji(segment) {
  const text = stripInlineJapaneseReadings(segment?.text);
  let reading = normalizeText(segment?.reading);
  if (!text || !reading || !hasKanjiText(text)) return null;

  const chars = Array.from(text);
  const firstKanjiIndex = chars.findIndex((char) => hasKanjiText(char));
  let lastKanjiIndex = -1;
  chars.forEach((char, index) => {
    if (hasKanjiText(char)) lastKanjiIndex = index;
  });
  if (firstKanjiIndex < 0 || lastKanjiIndex < firstKanjiIndex) return null;

  const before = chars.slice(0, firstKanjiIndex).join("");
  const after = chars.slice(lastKanjiIndex + 1).join("");
  const kanjiText = chars.slice(firstKanjiIndex, lastKanjiIndex + 1).join("");
  reading = trimReadingAffix(reading, before, "start");
  reading = trimReadingAffix(reading, after, "end");

  return reading ? { text: kanjiText, reading } : null;
}

function normalizeFuriganaSegments(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((segment) => limitFuriganaSegmentToKanji(segment))
    .filter(Boolean)
    .filter((segment) => {
      const key = `${segment.text}\n${segment.reading}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 80);
}

function getMissingKanjiCharacters(sentence, furiganaSegments) {
  const text = String(sentence || "");
  const covered = new Set();
  normalizeFuriganaSegments(furiganaSegments).forEach((segment) => {
    let index = text.indexOf(segment.text);
    while (index !== -1) {
      for (let offset = 0; offset < segment.text.length; offset += 1) {
        const char = segment.text[offset];
        if (hasKanjiText(char)) covered.add(index + offset);
      }
      index = text.indexOf(segment.text, index + segment.text.length);
    }
  });

  return Array.from(text).filter((char, index) => hasKanjiText(char) && !covered.has(index));
}

function mergeFuriganaSegments(sentence, ...segmentGroups) {
  const text = String(sentence || "");
  const seen = new Set();
  return segmentGroups
    .flatMap((segments) => normalizeFuriganaSegments(segments))
    .filter((segment) => text.includes(segment.text))
    .filter((segment) => {
      const key = `${segment.text}\n${segment.reading}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 80);
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

function normalizeLanguageMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "en_ja" || normalized === "ja_en" || normalized === "en_en"
    ? normalized
    : "en_en";
}

export async function generateFuriganaAnnotationsWithOpenAI(sentence) {
  const text = stripInlineJapaneseReadings(sentence);
  if (!text || !hasKanjiText(text) || !isOpenAiTranslationEnabled()) return [];

  const client = getOpenAiClient();
  if (!client) return [];

  const response = await client.responses.create({
    model: String(process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_OPENAI_TRANSLATION_MODEL).trim() ||
      DEFAULT_OPENAI_TRANSLATION_MODEL,
    input: [
      {
        role: "system",
        content:
          "You add furigana to Japanese sentences for language learners. Return annotations for every kanji-containing word or expression in the sentence. Each text must exactly match a surface substring in the sentence. Reading must be kana. Do not omit any kanji.",
      },
      {
        role: "user",
        content: `Japanese sentence: ${text}`,
      },
    ],
    reasoning: {
      effort: "minimal",
    },
    max_output_tokens: 700,
    text: {
      format: {
        type: "json_schema",
        name: "japanese_sentence_furigana",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            furigana: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  text: {
                    type: "string",
                    description: "Kanji-containing surface text exactly as it appears in the sentence.",
                  },
                  reading: {
                    type: "string",
                    description: "Kana reading for this text.",
                  },
                },
                required: ["text", "reading"],
              },
            },
          },
          required: ["furigana"],
        },
      },
    },
  });

  const parsed = parseResponseJson(response);
  return normalizeFuriganaSegments(parsed?.furigana).filter((segment) => text.includes(segment.text));
}

export async function generateExampleSentenceWithOpenAI({ word, definitions, languageMode } = {}) {
  const text = normalizeText(word);
  if (!text || !isOpenAiTranslationEnabled()) return null;

  const client = getOpenAiClient();
  if (!client) return null;

  const mode = normalizeLanguageMode(languageMode);
  const definitionList = Array.isArray(definitions)
    ? definitions.map((definition) => normalizeText(definition)).filter(Boolean).slice(0, 3)
    : [];
  const modeInstruction =
    mode === "en_ja"
      ? "Create one natural Japanese example sentence using the most likely Japanese translation. Also provide a concise English translation. Do not put readings in parentheses inside the sentence. Include furigana annotations for every kanji-containing word or expression in the Japanese sentence. Each annotation text must exactly match the surface text in the sentence, and reading must be kana. Do not include kana-only particles, punctuation, or duplicate annotations."
      : mode === "ja_en"
        ? "Create one natural Japanese example sentence using the Japanese vocabulary item. Also provide a concise English translation. Do not put readings in parentheses inside the sentence. Include furigana annotations for every kanji-containing word or expression in the Japanese sentence. Each annotation text must exactly match the surface text in the sentence, and reading must be kana. Do not include kana-only particles, punctuation, or duplicate annotations."
        : "Create one natural English example sentence using the English vocabulary item. Leave translation empty.";

  const response = await client.responses.create({
    model: String(process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_OPENAI_TRANSLATION_MODEL).trim() ||
      DEFAULT_OPENAI_TRANSLATION_MODEL,
    input: [
      {
        role: "system",
        content:
          "You create short learner-friendly vocabulary example sentences. Return exactly one natural sentence. Keep it suitable for general audiences, modern, and easy to understand. Do not mention that you are an AI.",
      },
      {
        role: "user",
        content: [
          modeInstruction,
          `Vocabulary item: ${text}`,
          definitionList.length ? `Meanings/translations: ${definitionList.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    reasoning: {
      effort: "minimal",
    },
    max_output_tokens: 500,
    text: {
      format: {
        type: "json_schema",
        name: "vocab_example_sentence",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            sentence: {
              type: "string",
              description: "One example sentence using the vocabulary item or its translation.",
            },
            translation: {
              type: "string",
              description: "English translation if the example sentence is Japanese; otherwise empty string.",
            },
            furigana: {
              type: "array",
              description: "Ordered annotations for every kanji-containing word or expression in the Japanese sentence. Empty for English examples.",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  text: {
                    type: "string",
                    description: "Kanji-containing surface text exactly as it appears in the sentence.",
                  },
                  reading: {
                    type: "string",
                    description: "Kana reading for this text.",
                  },
                },
                required: ["text", "reading"],
              },
            },
          },
          required: ["sentence", "translation", "furigana"],
        },
      },
    },
  });

  const parsed = parseResponseJson(response);
  const rawSentence = normalizeText(parsed?.sentence);
  const sentence = stripInlineJapaneseReadings(rawSentence);
  if (!sentence) return null;
  let furigana = mergeFuriganaSegments(
    sentence,
    getInlineJapaneseReadingSegments(rawSentence),
    parsed?.furigana
  );
  if ((mode === "en_ja" || mode === "ja_en") && getMissingKanjiCharacters(sentence, furigana).length > 0) {
    const repairedFurigana = await generateFuriganaAnnotationsWithOpenAI(sentence);
    const mergedFurigana = mergeFuriganaSegments(sentence, furigana, repairedFurigana);
    if (getMissingKanjiCharacters(sentence, mergedFurigana).length < getMissingKanjiCharacters(sentence, furigana).length) {
      furigana = mergedFurigana;
    }
  }

  return {
    sentence,
    translation: normalizeText(parsed?.translation),
    furigana,
    provider: "openai",
  };
}

export async function generateSpeechAudioWithOpenAI({ text, language } = {}) {
  const input = normalizeText(text);
  if (!input || !isOpenAiTtsEnabled()) return null;

  const client = getOpenAiClient();
  if (!client) return null;

  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const voice = String(
    normalizedLanguage.startsWith("ja")
      ? process.env.OPENAI_TTS_JAPANESE_VOICE || process.env.OPENAI_TTS_VOICE || DEFAULT_OPENAI_TTS_VOICE
      : process.env.OPENAI_TTS_ENGLISH_VOICE || process.env.OPENAI_TTS_VOICE || DEFAULT_OPENAI_TTS_VOICE
  ).trim() || DEFAULT_OPENAI_TTS_VOICE;
  const instructions = normalizedLanguage.startsWith("ja")
    ? "Speak clearly in natural Japanese for a language learner. Use careful pronunciation and a calm study pace."
    : "Speak clearly and naturally for a vocabulary learner. Use careful pronunciation and a calm study pace.";

  const response = await client.audio.speech.create({
    model: String(process.env.OPENAI_TTS_MODEL || DEFAULT_OPENAI_TTS_MODEL).trim() || DEFAULT_OPENAI_TTS_MODEL,
    voice,
    input,
    instructions,
    response_format: "mp3",
  });

  return Buffer.from(await response.arrayBuffer());
}
