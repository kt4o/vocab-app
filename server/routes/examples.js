import { Router } from "express";

export const examplesRouter = Router();

function getWordVariants(word) {
  const base = String(word || "")
    .trim()
    .toLowerCase();
  if (!base) return [];

  const variants = new Set([base]);

  if (base.endsWith("y") && base.length > 2) {
    variants.add(`${base.slice(0, -1)}ies`);
  } else if (base.endsWith("s")) {
    variants.add(`${base}es`);
  } else {
    variants.add(`${base}s`);
  }

  if (base.endsWith("e") && !base.endsWith("ee")) {
    variants.add(`${base.slice(0, -1)}ing`);
    variants.add(`${base}d`);
  } else {
    variants.add(`${base}ing`);
    variants.add(`${base}ed`);
  }

  return Array.from(variants).filter(Boolean);
}

function buildVariantRegexes(word) {
  const escaped = getWordVariants(word).map((variant) =>
    variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return escaped.map((variant) => new RegExp(`\\b${variant}\\b`, "i"));
}

function sanitizeSentence(value) {
  const sentence = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!sentence) return "";

  const words = sentence.split(" ");
  if (words.length < 3 || sentence.length < 12) return "";
  if (sentence.length > 240) return "";
  if (!/[A-Za-z]/.test(sentence)) return "";
  if (/^(we use|you use|it means|it refers to|used to describe)\b/i.test(sentence)) return "";
  if (/^(definition|example|synonym|antonym)\b/i.test(sentence)) return "";

  return sentence;
}

function collectSentence(target, seen, wordRegexes, value, requireWordMatch = true) {
  const sentence = sanitizeSentence(value);
  if (!sentence) return;
  const hasWordMatch = wordRegexes.some((regex) => regex.test(sentence));
  if (requireWordMatch && !hasWordMatch) return;

  const key = sentence.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  target.push(sentence);
}

async function fetchWordnikExamples(word, apiKey) {
  if (!apiKey) return [];

  const response = await fetch(
    `https://api.wordnik.com/v4/word.json/${encodeURIComponent(
      word
    )}/examples?includeDuplicates=false&useCanonical=true&limit=25&api_key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) return [];

  const payload = await response.json();
  const examples = Array.isArray(payload?.examples) ? payload.examples : [];
  return examples.map((item) => item?.text).filter(Boolean);
}

async function fetchDictionaryApiExamples(word) {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!response.ok) return [];

  const payload = await response.json();
  const sentences = [];

  const entries = Array.isArray(payload) ? payload : [];
  entries.forEach((entry) => {
    const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    meanings.forEach((meaning) => {
      const definitions = Array.isArray(meaning?.definitions) ? meaning.definitions : [];
      definitions.forEach((definition) => {
        if (definition?.example) sentences.push(definition.example);
      });
    });
  });

  return sentences;
}

function extractSentencesFromText(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

async function fetchWikipediaExamples(word) {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`
  );
  if (!response.ok) return [];

  const payload = await response.json();
  return extractSentencesFromText(payload?.extract || "");
}

async function fetchWikipediaSearchExamples(word) {
  const searchRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      word
    )}&srlimit=5&format=json&origin=*`
  );
  if (!searchRes.ok) return [];

  const searchPayload = await searchRes.json();
  const searchHits = Array.isArray(searchPayload?.query?.search) ? searchPayload.query.search : [];
  if (!searchHits.length) return [];

  const titles = searchHits
    .map((item) => String(item?.title || "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!titles.length) return [];

  const extractRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsentences=4&titles=${encodeURIComponent(
      titles.join("|")
    )}&format=json&origin=*`
  );
  if (!extractRes.ok) return [];

  const extractPayload = await extractRes.json();
  const pages = extractPayload?.query?.pages || {};
  const sentences = [];
  Object.values(pages).forEach((page) => {
    extractSentencesFromText(page?.extract || "").forEach((sentence) => {
      sentences.push(sentence);
    });
  });
  return sentences;
}

examplesRouter.get("/:word", async (req, res) => {
  const word = String(req.params.word || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z][a-z-]{0,48}$/.test(word)) {
    res.status(400).json({ error: "invalid-word" });
    return;
  }

  const wordnikApiKey = String(process.env.WORDNIK_API_KEY || "").trim();
  const wordRegexes = buildVariantRegexes(word);
  const seen = new Set();
  const examples = [];

  try {
    const [wordnikExamples, dictionaryApiExamples] = await Promise.all([
      fetchWordnikExamples(word, wordnikApiKey),
      fetchDictionaryApiExamples(word),
    ]);

    wordnikExamples.forEach((sentence) => {
      collectSentence(examples, seen, wordRegexes, sentence, false);
    });
    dictionaryApiExamples.forEach((sentence) => {
      collectSentence(examples, seen, wordRegexes, sentence, false);
    });
    if (examples.length < 4) {
      const wikipediaExamples = await fetchWikipediaExamples(word);
      wikipediaExamples.forEach((sentence) => {
        collectSentence(examples, seen, wordRegexes, sentence);
      });
    }
    if (examples.length < 3) {
      const wikipediaSearchExamples = await fetchWikipediaSearchExamples(word);
      wikipediaSearchExamples.forEach((sentence) => {
        collectSentence(examples, seen, wordRegexes, sentence);
      });
    }

    res.json({
      word,
      examples: examples.slice(0, 20),
      sources: {
        wordnik: Boolean(wordnikApiKey),
        dictionaryApi: true,
        wikipedia: true,
      },
    });
  } catch (error) {
    console.error("Failed to fetch dictionary examples", error);
    res.status(502).json({ error: "examples-unavailable" });
  }
});
