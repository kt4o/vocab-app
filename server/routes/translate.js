import { Router } from "express";
import { query } from "../db/client.js";

export const translateRouter = Router();

const TRANSLATION_CACHE_TTL_MS = (() => {
  const parsed = Math.floor(Number(process.env.TRANSLATION_CACHE_TTL_MS));
  if (!Number.isFinite(parsed) || parsed <= 0) return 7 * 24 * 60 * 60 * 1000;
  return parsed;
})();

function normalizeWordInput(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCacheKey({ sourceLang, targetLang, text }) {
  const normalizedText = normalizeWordInput(text).toLowerCase();
  return `${String(sourceLang || "").toLowerCase()}:${String(targetLang || "").toLowerCase()}:${normalizedText}`;
}

function parseCachedTranslations(value) {
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

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function hasJapaneseCharacters(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
}

function normalizeCandidateTranslation(value) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/^[\s"'`“”‘’(){}\[\]<>]+|[\s"'`“”‘’(){}\[\]<>]+$/g, "")
    .trim();
}

function rankAndDedupeCandidates(candidates, inputText) {
  const normalizedInput = String(inputText || "").trim().toLowerCase();
  const byTranslation = new Map();

  candidates.forEach((candidate) => {
    const cleaned = normalizeCandidateTranslation(candidate?.value);
    if (!cleaned) return;

    const normalized = cleaned.toLowerCase();
    if (normalized === normalizedInput) return;

    const hasJapanese = hasJapaneseCharacters(cleaned);
    const alphaOnly = /^[a-z0-9 _.,'"-]+$/i.test(cleaned);

    let score = Number(candidate?.score);
    if (!Number.isFinite(score)) score = 0;
    if (hasJapanese) score += 0.45;
    if (alphaOnly) score -= 0.25;

    const existing = byTranslation.get(normalized);
    if (!existing || score > existing.score) {
      byTranslation.set(normalized, { value: cleaned, score });
    }
  });

  const ranked = Array.from(byTranslation.values()).sort((a, b) => b.score - a.score);
  const japaneseFirst = ranked.filter((entry) => hasJapaneseCharacters(entry.value));
  const others = ranked.filter((entry) => !hasJapaneseCharacters(entry.value));
  const merged = [...japaneseFirst, ...others];
  return merged.map((entry) => entry.value).slice(0, 6);
}

function isSimpleEnglishWord(value) {
  return /^[a-z][a-z0-9' -]{1,63}$/i.test(String(value || "").trim());
}

function extractJishoTranslations(payload, inputText) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const candidates = [];
  const normalizedInput = String(inputText || "").trim().toLowerCase();

  items.slice(0, 10).forEach((item, itemIndex) => {
    const japaneseList = Array.isArray(item?.japanese) ? item.japanese : [];
    japaneseList.forEach((jp, jpIndex) => {
      const word = String(jp?.word || "").trim();
      const reading = String(jp?.reading || "").trim();
      const candidate = word || reading;
      if (!candidate) return;
      candidates.push({
        value: candidate,
        // Favor earlier results and explicit words over readings.
        score: 1 - itemIndex * 0.05 + (word ? 0.1 : 0) - jpIndex * 0.01,
      });
    });
  });

  return rankAndDedupeCandidates(candidates, normalizedInput);
}

async function fetchJishoTranslations(inputText) {
  if (!isSimpleEnglishWord(inputText)) return [];
  const response = await fetch(
    `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(inputText)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "my-vocab-app/1.0 (+https://localhost)",
      },
    }
  );
  if (!response.ok) return [];
  const payload = await response.json().catch(() => null);
  return extractJishoTranslations(payload, inputText);
}

async function readCachedTranslation(cacheKey) {
  const result = await query(
    `
      SELECT translations_json, provider, updated_at
      FROM translation_cache
      WHERE cache_key = $1
      LIMIT 1
    `,
    [cacheKey]
  );

  const row = result.rows[0];
  if (!row) return null;
  const translations = parseCachedTranslations(row.translations_json);
  if (!translations.length) return null;
  const updatedAtMs = new Date(String(row.updated_at || "")).getTime();
  if (!Number.isFinite(updatedAtMs)) return null;
  const isFresh = Date.now() - updatedAtMs <= TRANSLATION_CACHE_TTL_MS;
  return {
    translations,
    provider: normalizeProvider(row.provider, "unknown"),
    updatedAt: row.updated_at,
    isFresh,
  };
}

async function writeCachedTranslation({
  cacheKey,
  sourceLang,
  targetLang,
  inputText,
  translations,
  provider = "jisho",
}) {
  const nowIso = new Date().toISOString();
  await query(
    `
      INSERT INTO translation_cache (
        cache_key,
        source_lang,
        target_lang,
        input_text,
        translations_json,
        provider,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      ON CONFLICT(cache_key) DO UPDATE SET
        source_lang = excluded.source_lang,
        target_lang = excluded.target_lang,
        input_text = excluded.input_text,
        translations_json = excluded.translations_json,
        provider = excluded.provider,
        updated_at = excluded.updated_at
    `,
    [cacheKey, sourceLang, targetLang, inputText, JSON.stringify(translations), provider, nowIso]
  );
}

translateRouter.post("/en-ja", async (req, res) => {
  const text = normalizeWordInput(req.body?.text);
  if (!text) {
    res.status(400).json({ error: "translation-text-required" });
    return;
  }

  const sourceLang = "en";
  const targetLang = "ja";
  const cacheKey = buildCacheKey({ sourceLang, targetLang, text });

  try {
    const cached = await readCachedTranslation(cacheKey);
    if (cached?.isFresh && cached.provider === "jisho") {
      res.json({
        text,
        sourceLang,
        targetLang,
        translations: cached.translations,
        provider: cached.provider,
        cached: true,
        cachedAt: cached.updatedAt,
      });
      return;
    }

    let translations = [];
    let provider = "jisho";

    try {
      translations = await fetchJishoTranslations(text);
    } catch {
      translations = [];
    }

    // If Jisho has no current match, allow stale Jisho cache as a fallback.
    if (!translations.length && cached?.translations?.length && cached.provider === "jisho") {
      res.json({
        text,
        sourceLang,
        targetLang,
        translations: cached.translations,
        provider: cached.provider,
        cached: true,
        cachedAt: cached.updatedAt,
      });
      return;
    }

    if (!translations.length) {
      res.status(404).json({ error: "jisho-word-not-available" });
      return;
    }

    await writeCachedTranslation({
      cacheKey,
      sourceLang,
      targetLang,
      inputText: text,
      translations,
      provider,
    });

    res.json({
      text,
      sourceLang,
      targetLang,
      translations,
      cached: false,
      provider,
    });
  } catch (error) {
    console.error("Translation request failed", error);
    res.status(500).json({ error: "translation-request-failed" });
  }
});
