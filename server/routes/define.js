import { Router } from "express";
import { query } from "../db/client.js";

export const defineRouter = Router();

const DEFINITION_CACHE_TTL_MS = (() => {
  const parsed = Math.floor(Number(process.env.DEFINITION_CACHE_TTL_MS));
  if (!Number.isFinite(parsed) || parsed <= 0) return 7 * 24 * 60 * 60 * 1000;
  return parsed;
})();

function normalizeWordInput(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimpleEnglishWord(value) {
  return /^[a-z][a-z0-9' -]{1,63}$/i.test(String(value || "").trim());
}

function buildCacheKey(word) {
  return `en:definition:${String(word || "").trim().toLowerCase()}`;
}

function parseCachedDefinitions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function normalizeProvider(value, fallback = "unknown") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized || fallback;
}

function extractDictionaryApiDefinitions(payload) {
  const rows = Array.isArray(payload) ? payload : [];
  const seen = new Set();
  const all = [];

  rows.forEach((entry) => {
    const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    meanings.forEach((meaning) => {
      const definitions = Array.isArray(meaning?.definitions) ? meaning.definitions : [];
      definitions.forEach((item) => {
        const text = String(item?.definition || "").trim();
        if (!text) return;
        const normalized = text.toLowerCase();
        if (seen.has(normalized)) return;
        seen.add(normalized);
        all.push(text);
      });
    });
  });

  return all.slice(0, 12);
}

function extractDictionaryApiPronunciation(payload) {
  const firstEntry = Array.isArray(payload) ? payload[0] : null;
  const direct = String(firstEntry?.phonetic || "").trim();
  if (direct) return direct;

  const phonetics = Array.isArray(firstEntry?.phonetics) ? firstEntry.phonetics : [];
  for (const option of phonetics) {
    const text = String(option?.text || "").trim();
    if (text) return text;
  }
  return "";
}

function extractDatamuseDefinitions(payload) {
  const rows = Array.isArray(payload) ? payload : [];
  const seen = new Set();
  const all = [];

  rows.forEach((item) => {
    const defs = Array.isArray(item?.defs) ? item.defs : [];
    defs.forEach((definitionRow) => {
      const raw = String(definitionRow || "").trim();
      if (!raw) return;
      const text = raw.includes("\t") ? raw.split("\t").slice(1).join("\t").trim() : raw;
      if (!text) return;
      const normalized = text.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      all.push(text);
    });
  });

  return all.slice(0, 12);
}

async function fetchDictionaryApi(word) {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!response.ok) {
      return {
        definitions: [],
        pronunciation: "",
        provider: "dictionaryapi",
        error: response.status === 404 ? "definition-not-found" : "definition-provider-failed",
      };
    }
    const payload = await response.json().catch(() => null);
    return {
      definitions: extractDictionaryApiDefinitions(payload),
      pronunciation: extractDictionaryApiPronunciation(payload),
      provider: "dictionaryapi",
      error: "",
    };
  } catch {
    return {
      definitions: [],
      pronunciation: "",
      provider: "dictionaryapi",
      error: "definition-provider-failed",
    };
  }
}

async function fetchDatamuse(word) {
  try {
    const response = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=6`
    );
    if (!response.ok) {
      return {
        definitions: [],
        pronunciation: "",
        provider: "datamuse",
        error: "definition-provider-failed",
      };
    }
    const payload = await response.json().catch(() => null);
    return {
      definitions: extractDatamuseDefinitions(payload),
      pronunciation: "",
      provider: "datamuse",
      error: "",
    };
  } catch {
    return {
      definitions: [],
      pronunciation: "",
      provider: "datamuse",
      error: "definition-provider-failed",
    };
  }
}

async function readCachedDefinition(cacheKey) {
  const result = await query(
    `
      SELECT definitions_json, pronunciation, provider, updated_at
      FROM definition_cache
      WHERE cache_key = $1
      LIMIT 1
    `,
    [cacheKey]
  );

  const row = result.rows[0];
  if (!row) return null;
  const definitions = parseCachedDefinitions(row.definitions_json);
  const pronunciation = String(row.pronunciation || "").trim();
  const updatedAtMs = new Date(String(row.updated_at || "")).getTime();
  if (!Number.isFinite(updatedAtMs)) return null;
  return {
    definitions,
    pronunciation,
    provider: normalizeProvider(row.provider),
    updatedAt: String(row.updated_at || ""),
    isFresh: Date.now() - updatedAtMs <= DEFINITION_CACHE_TTL_MS,
  };
}

async function writeCachedDefinition({
  cacheKey,
  inputWord,
  definitions,
  pronunciation,
  provider,
}) {
  const nowIso = new Date().toISOString();
  await query(
    `
      INSERT INTO definition_cache (
        cache_key,
        input_word,
        definitions_json,
        pronunciation,
        provider,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6)
      ON CONFLICT(cache_key) DO UPDATE SET
        input_word = excluded.input_word,
        definitions_json = excluded.definitions_json,
        pronunciation = excluded.pronunciation,
        provider = excluded.provider,
        updated_at = excluded.updated_at
    `,
    [cacheKey, inputWord, JSON.stringify(definitions), pronunciation, provider, nowIso]
  );
}

defineRouter.post("/en", async (req, res) => {
  const word = normalizeWordInput(req.body?.word);
  if (!word) {
    res.status(400).json({ error: "definition-word-required" });
    return;
  }
  if (!isSimpleEnglishWord(word)) {
    res.status(400).json({ error: "invalid-english-word" });
    return;
  }

  const cacheKey = buildCacheKey(word);

  try {
    const cached = await readCachedDefinition(cacheKey);
    if (cached?.isFresh && cached.definitions.length > 0) {
      res.json({
        word,
        definitions: cached.definitions,
        pronunciation: cached.pronunciation,
        provider: cached.provider,
        cached: true,
        stale: false,
        cachedAt: cached.updatedAt,
      });
      return;
    }

    const primary = await fetchDictionaryApi(word);
    if (primary.definitions.length > 0) {
      await writeCachedDefinition({
        cacheKey,
        inputWord: word,
        definitions: primary.definitions,
        pronunciation: primary.pronunciation,
        provider: primary.provider,
      });
      res.json({
        word,
        definitions: primary.definitions,
        pronunciation: primary.pronunciation,
        provider: primary.provider,
        cached: false,
        stale: false,
      });
      return;
    }

    const fallback = await fetchDatamuse(word);
    if (fallback.definitions.length > 0) {
      await writeCachedDefinition({
        cacheKey,
        inputWord: word,
        definitions: fallback.definitions,
        pronunciation: fallback.pronunciation,
        provider: fallback.provider,
      });
      res.json({
        word,
        definitions: fallback.definitions,
        pronunciation: fallback.pronunciation,
        provider: fallback.provider,
        cached: false,
        stale: false,
      });
      return;
    }

    if (cached?.definitions?.length) {
      res.json({
        word,
        definitions: cached.definitions,
        pronunciation: cached.pronunciation,
        provider: cached.provider,
        cached: true,
        stale: true,
        cachedAt: cached.updatedAt,
      });
      return;
    }

    if (primary.error === "definition-not-found") {
      res.status(404).json({ error: "definition-not-found" });
      return;
    }

    res.status(502).json({ error: "definition-provider-failed" });
  } catch (error) {
    console.error("Definition request failed", error);
    res.status(500).json({ error: "definition-request-failed" });
  }
});
