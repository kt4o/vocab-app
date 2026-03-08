import { useState, useEffect, useRef } from "react";
import { CEFR_WORDLIST } from "./data/cefrWordlist";
import { Flashcards } from "./components/Flashcards";
import { Quiz } from "./components/Quiz";

const BASE_XP_GAIN_PER_WORD = 20;
const XP_GAIN_PER_QUIZ_CORRECT = 10;
const BASE_XP_PER_LEVEL = 100;
const XP_LEVEL_GROWTH = 1.2;
const BASE_COIN_GAIN_PER_WORD = 3;
const COIN_GAIN_PER_QUIZ_CORRECT = 1;
const MIN_QUIZ_QUESTIONS_FOR_COINS = 5;
const FULL_COIN_REWARD_QUIZ_LENGTH = 10;
const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000;
const DEFAULT_CHAPTER_ID = "general";
const WORD_MASTERY_MAX_XP = 10;
const WORD_MASTERY_BAR_STEPS = 5;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;
const STATE_API_PATH = `${API_BASE_URL}/api/state`;
const CLOUD_STATE_SYNC_DEBOUNCE_MS = 900;
const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";
const AUTH_USERNAME_STORAGE_KEY = "vocab_auth_username";
const WORD_DIFFICULTY_OPTIONS = [
  { value: "a1", label: "A1" },
  { value: "a2", label: "A2" },
  { value: "b1", label: "B1" },
  { value: "b2", label: "B2" },
  { value: "c1", label: "C1" },
  { value: "c2", label: "C2" },
];
const WORD_DIFFICULTY_VALUE_SET = new Set(WORD_DIFFICULTY_OPTIONS.map((option) => option.value));
const CEFR_WORDLIST_LEVEL_MAP = [
  { key: "A1", value: "a1" },
  { key: "A2", value: "a2" },
  { key: "B1", value: "b1" },
  { key: "B2", value: "b2" },
  { key: "C1", value: "c1" },
  { key: "C2", value: "c2" },
];
const MARKET_UPGRADES = [
  {
    id: "word_coin_bonus",
    name: "Word Coin Bonus",
    description: "+1 coin per new word per level.",
    baseCost: 40,
    costGrowth: 1.65,
    maxLevel: 5,
  },
  {
    id: "xp_boost",
    name: "XP Boost",
    description: "+10% XP gain per level.",
    baseCost: 65,
    costGrowth: 1.75,
    maxLevel: 5,
  },
];

function getXpRequiredForLevel(level) {
  return Math.floor(BASE_XP_PER_LEVEL * Math.pow(XP_LEVEL_GROWTH, Math.max(level - 1, 0)));
}

function getLevelFromXp(totalXp) {
  let remainingXp = Math.max(totalXp, 0);
  let level = 1;

  while (remainingXp >= getXpRequiredForLevel(level)) {
    remainingXp -= getXpRequiredForLevel(level);
    level += 1;
  }

  return level;
}

function getXpProgress(totalXp) {
  let remainingXp = Math.max(totalXp, 0);
  let level = 1;

  while (remainingXp >= getXpRequiredForLevel(level)) {
    remainingXp -= getXpRequiredForLevel(level);
    level += 1;
  }

  return remainingXp;
}

function getXpToNextLevel(totalXp) {
  const level = getLevelFromXp(totalXp);
  return getXpRequiredForLevel(level);
}

function getWordXpGain(streakCount) {
  const streakBonus = Math.min(12, Math.max(streakCount - 1, 0) * 2);
  return BASE_XP_GAIN_PER_WORD + streakBonus;
}

function getWordCoinGain(streakCount) {
  const streakBonus = Math.min(3, Math.floor(Math.max(streakCount - 1, 0) / 2));
  return BASE_COIN_GAIN_PER_WORD + streakBonus;
}

function getQuizCoinReward(totalQuestions, correctAnswers) {
  if (totalQuestions < MIN_QUIZ_QUESTIONS_FOR_COINS) return 0;

  const safeCorrect = Math.max(0, Math.min(correctAnswers, totalQuestions));
  const accuracy = totalQuestions > 0 ? Math.round((safeCorrect / totalQuestions) * 100) : 0;
  const lengthMultiplier = Math.min(totalQuestions / FULL_COIN_REWARD_QUIZ_LENGTH, 1);
  const scaledCorrectCoins = Math.floor(safeCorrect * COIN_GAIN_PER_QUIZ_CORRECT * lengthMultiplier);
  const completionCoinBonus =
    accuracy === 100 ? 8 : accuracy >= 80 ? 5 : accuracy >= 60 ? 3 : 2;

  return scaledCorrectCoins + completionCoinBonus;
}

function getUpgradeCost(upgrade, level) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
}

function getWordDefinitions(wordEntry) {
  if (Array.isArray(wordEntry?.definitions) && wordEntry.definitions.length > 0) {
    return wordEntry.definitions;
  }
  if (wordEntry?.definition && wordEntry.definition.trim()) {
    return [wordEntry.definition];
  }
  return [];
}

function getSelectedDefinition(wordEntry) {
  const definitions = getWordDefinitions(wordEntry);
  if (!definitions.length) return "";
  const safeIndex = Math.min(
    Math.max(wordEntry?.currentDefinitionIndex ?? 0, 0),
    definitions.length - 1
  );
  return definitions[safeIndex];
}

function getWordExamples(wordEntry) {
  const examples = Array.isArray(wordEntry?.examples) ? wordEntry.examples : [];
  return examples
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function getMistakeCount(wordEntry) {
  const count = Number(wordEntry?.mistakeCount ?? 0);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

function getWordMasteryXp(wordEntry) {
  const xp = Number(wordEntry?.masteryXp ?? 0);
  if (!Number.isFinite(xp)) return 0;
  return Math.max(0, Math.min(Math.floor(xp), WORD_MASTERY_MAX_XP));
}

function getWordMasteryMeta(wordEntry) {
  const masteryXp = getWordMasteryXp(wordEntry);

  if (masteryXp >= 9) {
    return {
      level: 4,
      label: "Mastered",
      masteryXp,
      nextLevelXp: WORD_MASTERY_MAX_XP,
    };
  }
  if (masteryXp >= 6) {
    return {
      level: 3,
      label: "Strong",
      masteryXp,
      nextLevelXp: 9,
    };
  }
  if (masteryXp >= 3) {
    return {
      level: 2,
      label: "Familiar",
      masteryXp,
      nextLevelXp: 6,
    };
  }
  return {
    level: 1,
    label: "Learned",
    masteryXp,
    nextLevelXp: 3,
  };
}

function getWordMasteryBarFillCount(wordEntry) {
  const masteryXp = getWordMasteryXp(wordEntry);
  if (masteryXp <= 0) return 0;
  return Math.min(WORD_MASTERY_BAR_STEPS, Math.ceil((masteryXp / WORD_MASTERY_MAX_XP) * WORD_MASTERY_BAR_STEPS));
}

function getWordMasteryBlocks(wordEntry) {
  const filled = getWordMasteryBarFillCount(wordEntry);
  const empty = Math.max(WORD_MASTERY_BAR_STEPS - filled, 0);
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function extractDefinitions(apiPayload) {
  const seen = new Set();
  const all = [];

  (apiPayload?.[0]?.meanings || []).forEach((meaning) => {
    (meaning?.definitions || []).forEach((item) => {
      const text = (item?.definition || "").trim();
      if (!text) return;
      const normalized = text.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      all.push(text);
    });
  });

  return all;
}

function extractExampleSentences(apiPayload) {
  const seen = new Set();
  const all = [];

  (apiPayload?.[0]?.meanings || []).forEach((meaning) => {
    (meaning?.definitions || []).forEach((item) => {
      const text = sanitizeExampleSentence(item?.example);
      if (!text) return;
      const normalized = text.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      all.push(text);
    });
  });

  return all.slice(0, 3);
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeExampleSentence(value) {
  const sentence = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "");
  if (!sentence) return "";
  if (sentence.split(/\s+/).length < 3) return "";
  return sentence;
}

function scoreExampleSentence(sentence, word) {
  const safeSentence = sanitizeExampleSentence(sentence);
  const safeWord = String(word || "").trim().toLowerCase();
  if (!safeSentence || !safeWord) return Number.NEGATIVE_INFINITY;

  if (/^(see also|synonyms?|antonyms?|etymology|pronunciation|usage notes?)\b/i.test(safeSentence)) {
    return Number.NEGATIVE_INFINITY;
  }
  if (/\b(may refer to|can refer to)\b/i.test(safeSentence)) return Number.NEGATIVE_INFINITY;
  if (/^[-*]\s+/.test(safeSentence)) return Number.NEGATIVE_INFINITY;
  if (/\[[^\]]+\]/.test(safeSentence)) return Number.NEGATIVE_INFINITY;

  const wordRegex = new RegExp(`\\b${escapeRegex(safeWord)}\\b`, "gi");
  const matchCount = (safeSentence.toLowerCase().match(wordRegex) || []).length;
  if (matchCount === 0) return Number.NEGATIVE_INFINITY;

  const tokenCount = safeSentence.split(/\s+/).filter(Boolean).length;
  if (tokenCount < 4 || tokenCount > 28) return Number.NEGATIVE_INFINITY;
  let score = 0;

  if (tokenCount >= 6 && tokenCount <= 16) score += 4;
  else if (tokenCount >= 4 && tokenCount <= 22) score += 2;
  else score -= 2;

  if (matchCount === 1) score += 3;
  else if (matchCount === 2) score += 1;
  else score -= 2;

  if (/^[A-Z]/.test(safeSentence)) score += 1;
  if (/[.!?]["']?$/.test(safeSentence)) score += 1;
  if (/[;:()[\]{}<>]/.test(safeSentence)) score -= 1;
  if (/(https?:\/\/|www\.|@|#|\\)/i.test(safeSentence)) score -= 3;
  if (/[A-Z]{4,}/.test(safeSentence)) score -= 2;

  const digitCount = (safeSentence.match(/\d/g) || []).length;
  if (digitCount > 0) score -= Math.min(2, digitCount);

  return score;
}

function rankAndSelectExamples(word, dictionaryExamples = [], supplementalExamples = []) {
  const seen = new Set();
  const candidates = [];

  const addCandidates = (items, source) => {
    items.forEach((item) => {
      const sentence = sanitizeExampleSentence(item);
      if (!sentence) return;
      const key = sentence.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ sentence, source });
    });
  };

  addCandidates(dictionaryExamples, "dictionary");
  addCandidates(supplementalExamples, "supplemental");

  const ranked = candidates
    .map((entry) => {
      const qualityScore = scoreExampleSentence(entry.sentence, word);
      if (!Number.isFinite(qualityScore)) return null;
      const sourceBonus = entry.source === "dictionary" ? 1 : 0;
      return {
        sentence: entry.sentence,
        qualityScore,
        score: qualityScore + sourceBonus,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.sentence.length - b.sentence.length;
    });

  const highQuality = ranked.filter((entry) => entry.qualityScore >= 4);
  const selected = (highQuality.length ? highQuality : ranked).slice(0, 3);
  return selected.map((entry) => entry.sentence);
}

function extractSentencesFromText(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => sanitizeExampleSentence(item))
    .filter(Boolean);
}

async function fetchSupplementalExamples(word) {
  const safeWord = String(word || "").trim();
  if (!safeWord) return [];

  const normalizedWord = safeWord.toLowerCase();
  const wordRegex = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, "i");
  const seen = new Set();
  const collected = [];

  const pushExample = (candidate) => {
    const sentence = sanitizeExampleSentence(candidate);
    if (!sentence) return;
    if (!wordRegex.test(sentence.toLowerCase())) return;
    const key = sentence.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    collected.push(sentence);
  };

  try {
    const quoteRes = await fetch(
      `https://api.quotable.io/search/quotes?query=${encodeURIComponent(safeWord)}&limit=20`
    );
    if (quoteRes.ok) {
      const quoteData = await quoteRes.json();
      const quotes = Array.isArray(quoteData?.results) ? quoteData.results : [];
      quotes.forEach((item) => pushExample(item?.content));
    }
  } catch {
    // Ignore supplemental source failures and continue.
  }

  if (collected.length < 3) {
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(safeWord)}`
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const sentences = extractSentencesFromText(wikiData?.extract || "");
        sentences.forEach((sentence) => pushExample(sentence));
      }
    } catch {
      // Ignore supplemental source failures and continue.
    }
  }

  return collected.slice(0, 3);
}

function extractPronunciation(apiPayload) {
  const firstEntry = Array.isArray(apiPayload) ? apiPayload[0] : null;
  const direct = String(firstEntry?.phonetic || "").trim();
  if (direct) return direct;

  const phoneticOptions = Array.isArray(firstEntry?.phonetics) ? firstEntry.phonetics : [];
  for (const option of phoneticOptions) {
    const text = String(option?.text || "").trim();
    if (text) return text;
  }

  return "";
}

function parseJsonSafely(rawValue, fallbackValue) {
  if (!rawValue) return fallbackValue;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

function parseStoredScoreNumber(rawValue, fallbackValue = 0) {
  const parsed = parseJsonSafely(rawValue, fallbackValue);
  const safe = Number(parsed);
  return Number.isFinite(safe) ? safe : fallbackValue;
}

function parseStoredStreak(rawValue) {
  const parsed = parseJsonSafely(rawValue, null);
  const count = Math.max(1, Math.floor(Number(parsed?.count) || 1));
  const lastDate = parsed?.lastDate ? String(parsed.lastDate) : null;
  return { count, lastDate };
}

function parseStoredMarketLevels(rawValue) {
  const parsed = parseJsonSafely(rawValue, {});
  return {
    word_coin_bonus: Math.max(0, Math.floor(Number(parsed?.word_coin_bonus) || 0)),
    xp_boost: Math.max(0, Math.floor(Number(parsed?.xp_boost) || 0)),
  };
}

function parseStoredBoolean(value, fallbackValue = false) {
  return typeof value === "boolean" ? value : fallbackValue;
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function buildQuizQuestions(words, options = {}) {
  const mistakesOnly = Boolean(options?.mistakesOnly);
  let baseWords = (words || []).filter((entry) => getSelectedDefinition(entry));

  if (mistakesOnly) {
    baseWords = baseWords.filter((entry) => getMistakeCount(entry) > 0);

    const weighted = shuffleArray(
      baseWords.flatMap((entry) => Array(Math.min(getMistakeCount(entry), 4)).fill(entry))
    );
    const seen = new Set();
    baseWords = weighted.filter((entry) => {
      const key = entry.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const allDefinitions = Array.from(
    new Set(baseWords.map((entry) => getSelectedDefinition(entry)).filter(Boolean))
  );

  const questions = baseWords
    .map((entry) => {
      const correctDefinition = getSelectedDefinition(entry);
      const distractors = shuffleArray(
        allDefinitions.filter((definition) => definition !== correctDefinition)
      ).slice(0, 3);
      const options = shuffleArray([correctDefinition, ...distractors]);

      return {
        word: entry.word,
        correctDefinition,
        options,
        sourceBookId: entry.sourceBookId ?? null,
        chapterId: entry.chapterId || DEFAULT_CHAPTER_ID,
      };
    })
    .filter((question) => question.options.length >= 2);

  return shuffleArray(questions);
}

function buildSentenceWithBlank(sentence, word) {
  const safeSentence = String(sentence || "").trim();
  const safeWord = String(word || "").trim();
  if (!safeSentence || !safeWord) return "";

  const escaped = safeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRegex = new RegExp(`\\b${escaped}\\b`, "gi");
  if (wordRegex.test(safeSentence)) {
    return safeSentence.replace(wordRegex, "____");
  }

  return `${safeSentence} (____)`;
}

function buildBlankQuizQuestions(words, options = {}) {
  const mistakesOnly = Boolean(options?.mistakesOnly);
  let baseWords = (words || []).filter(
    (entry) => getSelectedDefinition(entry) && getWordExamples(entry).length > 0
  );

  if (mistakesOnly) {
    baseWords = baseWords.filter((entry) => getMistakeCount(entry) > 0);

    const weighted = shuffleArray(
      baseWords.flatMap((entry) => Array(Math.min(getMistakeCount(entry), 4)).fill(entry))
    );
    const seen = new Set();
    baseWords = weighted.filter((entry) => {
      const key = entry.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const allWords = Array.from(new Set(baseWords.map((entry) => String(entry.word || "").trim()).filter(Boolean)));

  const questions = baseWords
    .map((entry) => {
      const word = String(entry.word || "").trim();
      const examples = getWordExamples(entry);
      const sentence = examples[0] || "";
      const sentenceWithBlank = buildSentenceWithBlank(sentence, word);
      if (!sentenceWithBlank) return null;

      const distractors = shuffleArray(allWords.filter((candidate) => candidate !== word)).slice(0, 3);
      const options = shuffleArray([word, ...distractors]);

      return {
        word,
        correctDefinition: getSelectedDefinition(entry),
        sentenceWithBlank,
        options,
        sourceBookId: entry.sourceBookId ?? null,
        chapterId: entry.chapterId || DEFAULT_CHAPTER_ID,
      };
    })
    .filter((question) => question && question.options.length >= 2);

  return shuffleArray(questions);
}

function normalizeQuizAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getWordSessionKey(sourceBookId, chapterId, word) {
  const safeBookId = String(sourceBookId ?? "");
  const safeChapterId = String(chapterId || DEFAULT_CHAPTER_ID);
  const safeWord = normalizeQuizAnswer(word);
  return `${safeBookId}::${safeChapterId}::${safeWord}`;
}

function getWordVariantForms(value) {
  const normalized = normalizeQuizAnswer(value);
  const forms = new Set();
  if (!normalized) return forms;

  forms.add(normalized);

  // Keep variant logic conservative to avoid accepting unrelated words.
  const pushIfValid = (candidate) => {
    const trimmed = String(candidate || "").trim();
    if (trimmed.length >= 3) forms.add(trimmed);
  };

  if (/^[a-z]+$/.test(normalized)) {
    if (normalized.endsWith("ing") && normalized.length > 5) {
      const base = normalized.slice(0, -3);
      pushIfValid(base);
      pushIfValid(`${base}e`);
      if (/(.)\1$/.test(base)) pushIfValid(base.slice(0, -1));
    }

    if (normalized.endsWith("ed") && normalized.length > 4) {
      const base = normalized.slice(0, -2);
      pushIfValid(base);
      pushIfValid(`${base}e`);
      if (/(.)\1$/.test(base)) pushIfValid(base.slice(0, -1));
    }

    if (normalized.endsWith("ies") && normalized.length > 4) {
      pushIfValid(`${normalized.slice(0, -3)}y`);
    }

    if (normalized.endsWith("es") && normalized.length > 4) {
      pushIfValid(normalized.slice(0, -2));
    }

    if (normalized.endsWith("s") && normalized.length > 3) {
      pushIfValid(normalized.slice(0, -1));
    }
  }

  return forms;
}

function isEquivalentTypingAnswer(typedValue, targetValue) {
  const typedNormalized = normalizeQuizAnswer(typedValue);
  const targetNormalized = normalizeQuizAnswer(targetValue);
  if (!typedNormalized || !targetNormalized) return false;
  if (typedNormalized === targetNormalized) return true;

  const typedForms = getWordVariantForms(typedNormalized);
  const targetForms = getWordVariantForms(targetNormalized);

  for (const form of typedForms) {
    if (targetForms.has(form)) return true;
  }

  return false;
}

function getCurrentWeekKey(date = new Date()) {
  const localDate = new Date(date);
  const day = localDate.getDay();
  localDate.setHours(0, 0, 0, 0);
  localDate.setDate(localDate.getDate() - day);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateOfMonth}`;
}

function getDefaultWeeklyStats(date = new Date()) {
  return {
    weekKey: getCurrentWeekKey(date),
    definitionsAdded: 0,
    questionsCompleted: 0,
    wordsAdded: 0,
    timeSpentSeconds: 0,
  };
}

function ensureCurrentWeekStats(stats) {
  if (!stats || typeof stats !== "object") {
    return getDefaultWeeklyStats();
  }

  const currentWeekKey = getCurrentWeekKey();
  if (stats.weekKey !== currentWeekKey) {
    return getDefaultWeeklyStats();
  }

  const safeDefinitionsAdded = Math.max(0, Math.floor(Number(stats.definitionsAdded) || 0));
  const safeQuestionsCompleted = Math.max(0, Math.floor(Number(stats.questionsCompleted) || 0));
  const safeWordsAdded = Math.max(0, Math.floor(Number(stats.wordsAdded) || 0));
  const safeTimeSpentSeconds = Math.max(0, Math.floor(Number(stats.timeSpentSeconds) || 0));

  if (
    safeDefinitionsAdded === stats.definitionsAdded &&
    safeQuestionsCompleted === stats.questionsCompleted &&
    safeWordsAdded === stats.wordsAdded &&
    safeTimeSpentSeconds === stats.timeSpentSeconds
  ) {
    return stats;
  }

  return {
    weekKey: currentWeekKey,
    definitionsAdded: safeDefinitionsAdded,
    questionsCompleted: safeQuestionsCompleted,
    wordsAdded: safeWordsAdded,
    timeSpentSeconds: safeTimeSpentSeconds,
  };
}

function parseStoredWeeklyStats(rawValue) {
  if (!rawValue) return getDefaultWeeklyStats();

  try {
    return ensureCurrentWeekStats(JSON.parse(rawValue));
  } catch {
    return getDefaultWeeklyStats();
  }
}

function formatWeeklyTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getCurrentDayKey(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateOfMonth}`;
}

function sanitizeActivityEntry(entry) {
  return {
    definitionsAdded: Math.max(0, Math.floor(Number(entry?.definitionsAdded) || 0)),
    wordsAdded: Math.max(0, Math.floor(Number(entry?.wordsAdded) || 0)),
    questionsCompleted: Math.max(0, Math.floor(Number(entry?.questionsCompleted) || 0)),
    timeSpentSeconds: Math.max(0, Math.floor(Number(entry?.timeSpentSeconds) || 0)),
  };
}

function parseStoredActivityHistory(rawValue) {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const next = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      next[key] = sanitizeActivityEntry(value);
    });
    return next;
  } catch {
    return {};
  }
}

function mergeActivityDelta(history, delta, date = new Date()) {
  const dayKey = getCurrentDayKey(date);
  const safeDelta = sanitizeActivityEntry(delta);
  const current = sanitizeActivityEntry(history?.[dayKey]);

  return {
    ...(history || {}),
    [dayKey]: {
      definitionsAdded: current.definitionsAdded + safeDelta.definitionsAdded,
      wordsAdded: current.wordsAdded + safeDelta.wordsAdded,
      questionsCompleted: current.questionsCompleted + safeDelta.questionsCompleted,
      timeSpentSeconds: current.timeSpentSeconds + safeDelta.timeSpentSeconds,
    },
  };
}

function sumActivityHistory(history, filterFn = null) {
  const entries = Object.entries(history || {});
  return entries.reduce(
    (totals, [key, value]) => {
      if (typeof filterFn === "function" && !filterFn(key)) return totals;
      const safe = sanitizeActivityEntry(value);
      return {
        definitionsAdded: totals.definitionsAdded + safe.definitionsAdded,
        wordsAdded: totals.wordsAdded + safe.wordsAdded,
        questionsCompleted: totals.questionsCompleted + safe.questionsCompleted,
        timeSpentSeconds: totals.timeSpentSeconds + safe.timeSpentSeconds,
      };
    },
    { definitionsAdded: 0, wordsAdded: 0, questionsCompleted: 0, timeSpentSeconds: 0 }
  );
}

function getRecentPeriodTotals(history, days) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 1));
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (safeDays - 1));
  const startKey = getCurrentDayKey(start);
  const endKey = getCurrentDayKey(end);

  return sumActivityHistory(history, (key) => key >= startKey && key <= endKey);
}

function getMonthTotals(history, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}-${month}-`;
  return sumActivityHistory(history, (key) => key.startsWith(prefix));
}

function buildDefinitionTrend(history, days = 14) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 14));
  const bars = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = getCurrentDayKey(date);
    const entry = sanitizeActivityEntry(history?.[key]);
    bars.push({
      key,
      label: String(date.getDate()),
      value: entry.definitionsAdded,
    });
  }

  return bars;
}

function createDefaultChapter() {
  return { id: DEFAULT_CHAPTER_ID, name: "General" };
}

function sanitizeChapterId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function ensureBookChapters(book) {
  const existingChapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const uniqueChapters = [];
  const chapterIdSet = new Set();

  for (const chapter of existingChapters) {
    const chapterId = String(chapter?.id || "").trim();
    const chapterName = String(chapter?.name || "").trim();
    if (!chapterId || !chapterName || chapterIdSet.has(chapterId)) continue;
    chapterIdSet.add(chapterId);
    uniqueChapters.push({ id: chapterId, name: chapterName });
  }

  if (uniqueChapters.length === 0) {
    uniqueChapters.push(createDefaultChapter());
    chapterIdSet.add(DEFAULT_CHAPTER_ID);
  }

  const fallbackChapterId = uniqueChapters[0].id;
  const normalizedWords = (book?.words || []).map((wordEntry) => {
    const chapterId = String(wordEntry?.chapterId || "").trim();
    const safeChapterId = chapterIdSet.has(chapterId) ? chapterId : fallbackChapterId;
    return {
      ...wordEntry,
      chapterId: safeChapterId,
      difficulty: normalizeWordDifficulty(wordEntry?.difficulty),
      examples: getWordExamples(wordEntry),
      masteryXp: getWordMasteryXp(wordEntry),
    };
  });

  return {
    ...book,
    chapters: uniqueChapters,
    words: normalizedWords,
  };
}

function normalizeBooksData(rawBooks) {
  const safeBooks = Array.isArray(rawBooks) ? rawBooks : [];
  return safeBooks.map((book) => ensureBookChapters(book));
}

function getBookChapterList(book) {
  return ensureBookChapters(book || {}).chapters;
}

function normalizeWordDifficulty(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return WORD_DIFFICULTY_VALUE_SET.has(normalized) ? normalized : "";
}

function getDifficultyLabel(value) {
  const normalized = normalizeWordDifficulty(value);
  if (!normalized) return "Unassigned";
  const match = WORD_DIFFICULTY_OPTIONS.find((option) => option.value === normalized);
  return match?.label || "Unassigned";
}

function getDifficultyExplanation(value) {
  const normalized = normalizeWordDifficulty(value);
  switch (normalized) {
    case "a1":
      return "A1: beginner vocabulary used in very simple everyday situations.";
    case "a2":
      return "A2: basic vocabulary for routine tasks and short conversations.";
    case "b1":
      return "B1: intermediate vocabulary for familiar topics and practical communication.";
    case "b2":
      return "B2: upper-intermediate vocabulary for more detailed and abstract discussion.";
    case "c1":
      return "C1: advanced vocabulary used flexibly in academic and professional contexts.";
    case "c2":
      return "C2: near-native level vocabulary with nuanced and precise meaning.";
    default:
      return "No CEFR level assigned yet.";
  }
}

function getCefrFromWordlist(word) {
  const cleaned = String(word || "")
    .trim()
    .toLowerCase();
  if (!cleaned) return "";

  for (const level of CEFR_WORDLIST_LEVEL_MAP) {
    const levelSet = CEFR_WORDLIST?.[level.key];
    if (levelSet?.has(cleaned)) return level.value;
  }

  return "";
}

function estimateCefrLevel(word) {
  const exactMatchLevel = getCefrFromWordlist(word);
  if (exactMatchLevel) return exactMatchLevel;

  const cleaned = String(word || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!cleaned) return "";

  let score = 0;
  const length = cleaned.length;

  if (length >= 12) score += 5;
  else if (length >= 10) score += 4;
  else if (length >= 8) score += 3;
  else if (length >= 6) score += 2;
  else if (length >= 5) score += 1;

  if (/(tion|sion|ment|ness|ance|ence|ality|ically|ology|phobia|tarian)$/.test(cleaned)) {
    score += 2;
  }
  if (/(sub|inter|trans|over|under|anti|counter)/.test(cleaned)) {
    score += 1;
  }
  if (/(ough|eigh|ph|rh|ps|gn|mn)/.test(cleaned)) {
    score += 1;
  }
  if (/(.)\1\1/.test(cleaned)) {
    score += 1;
  }

  if (score <= 1) return "a1";
  if (score === 2) return "a2";
  if (score === 3) return "b1";
  if (score === 4) return "b2";
  if (score === 5) return "c1";
  return "c2";
}

function areStringArraysEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function normalizeQuizMode(value, fallback = "normal") {
  const allowed = new Set(["normal", "typing", "blank"]);
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function InAppDropdown({
  value,
  options = [],
  onChange,
  className = "",
  triggerClassName = "",
  menuClassName = "",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((option) => option.value === value) || options[0] || null;
  const containerClassName = `inAppDropdown ${className}`.trim();
  const resolvedTriggerClassName = `inAppDropdownTrigger ${triggerClassName}`.trim();
  const resolvedMenuClassName = `inAppDropdownMenu ${menuClassName}`.trim();

  return (
    <div className={containerClassName} ref={dropdownRef}>
      <button
        type="button"
        className={resolvedTriggerClassName}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="inAppDropdownValue">{selectedOption?.label || ""}</span>
        <span className={`inAppDropdownChevron ${isOpen ? "isOpen" : ""}`}>▼</span>
      </button>
      {isOpen && (
        <div className={resolvedMenuClassName} role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`inAppDropdownOption ${isSelected ? "isSelected" : ""}`}
                onClick={() => {
                  setIsOpen(false);
                  if (option.value !== value) {
                    onChange?.(option.value);
                  }
                }}
                role="option"
                aria-selected={isSelected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PinIcon({ pinned }) {
  return (
    <span className="pinIcon" aria-hidden="true">
      <svg className="pinIconSvg" viewBox="0 0 24 24" focusable="false" preserveAspectRatio="xMidYMid meet">
        <path
          d="M12 2.8 14.9 8.7l6.5.9-4.7 4.5 1.1 6.3L12 17.4 6.2 20.4l1.1-6.3L2.6 9.6l6.5-.9L12 2.8z"
          className={pinned ? "pinIconStar isPinned" : "pinIconStar"}
        />
      </svg>
    </span>
  );
}

const QUIZ_SUCCESS_PROMPTS = [
  "Nice work. You nailed that one.",
  "Great job. Keep the momentum going.",
  "Correct. You're building strong recall.",
  "Excellent answer. You're leveling up fast.",
];

const QUIZ_MISS_PROMPTS = [
  "Close one. Every miss sharpens your memory.",
  "No stress. Mistakes are part of learning.",
  "Keep going. You'll lock this word in soon.",
  "Good try. Review it once and you'll get it next time.",
];

const APP_ENV = String(import.meta.env.VITE_APP_ENV || "").trim().toLowerCase();
const IS_BETA_BUILD = APP_ENV === "beta";
const BETA_ACCESS_CODE = String(import.meta.env.VITE_BETA_CODE || "").trim();
const BETA_ACCESS_STORAGE_KEY = "vocab_beta_access_code";

function BetaGate({ onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!BETA_ACCESS_CODE) {
      onUnlock(true);
      return;
    }
    if (code.trim() === BETA_ACCESS_CODE) {
      localStorage.setItem(BETA_ACCESS_STORAGE_KEY, BETA_ACCESS_CODE);
      onUnlock(true);
      return;
    }
    setError("Invalid beta code.");
  }

  return (
    <main className="betaGateWrap">
      <section className="betaGateCard">
        <p className="betaGateEyebrow">Closed Beta</p>
        <h1>Tester Access</h1>
        <p className="betaGateHint">Enter your beta code to continue.</p>
        <form onSubmit={handleSubmit} className="betaGateForm">
          <label className="visuallyHidden" htmlFor="beta-access-code">Beta code</label>
          <input
            id="beta-access-code"
            className="betaGateInput"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (error) setError("");
            }}
            autoComplete="off"
            placeholder="Beta access code"
            autoFocus
          />
          <button type="submit" className="betaGateBtn">Enter Beta</button>
        </form>
        {error ? <p className="betaGateError">{error}</p> : null}
      </section>
    </main>
  );
}

export default function App() {
  const [isBetaUnlocked, setIsBetaUnlocked] = useState(() => {
    if (!IS_BETA_BUILD || !BETA_ACCESS_CODE) return true;
    return localStorage.getItem(BETA_ACCESS_STORAGE_KEY) === BETA_ACCESS_CODE;
  });
  const [screen, setScreen] = useState("dashboard");
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("vocab_theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [books, setBooks] = useState(() => {
    const saved = localStorage.getItem("vocab_books");
    const parsedBooks = parseJsonSafely(saved, []);
    return normalizeBooksData(parsedBooks);
  });
  const [currentBookId, setCurrentBookId] = useState(null);
  const [inputWord, setInputWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem("vocab_streak");
    return parseStoredStreak(saved);
  });
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem("vocab_xp");
    return parseStoredScoreNumber(saved, 0);
  });
  const [coins, setCoins] = useState(() => {
    const saved = localStorage.getItem("vocab_coins");
    return parseStoredScoreNumber(saved, 0);
  });
  const [isEconomyEnabled, setIsEconomyEnabled] = useState(() => {
    const saved = localStorage.getItem("vocab_economy_enabled");
    if (saved === null) return true;
    return saved === "true";
  });
  const [isLevelsEnabled, setIsLevelsEnabled] = useState(() => {
    const saved = localStorage.getItem("vocab_levels_enabled");
    if (saved === null) return true;
    return saved === "true";
  });
  const [marketLevels, setMarketLevels] = useState(() => {
    const saved = localStorage.getItem("vocab_market_levels");
    return parseStoredMarketLevels(saved);
  });
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [bookPendingDelete, setBookPendingDelete] = useState(null);
  const [chapterPendingDelete, setChapterPendingDelete] = useState(null);
  const [noticeModal, setNoticeModal] = useState(null);
  const [quizBackScreen, setQuizBackScreen] = useState("dashboard");
  const [quizMode, setQuizMode] = useState("normal");
  const [quizSetupSelection, setQuizSetupSelection] = useState({
    bookIds: [],
    chapterKeys: [],
    difficultyKeys: [],
  });
  const [activeQuizWords, setActiveQuizWords] = useState([]);
  const [activeQuizTitle, setActiveQuizTitle] = useState("Quiz");
  const [activeQuizMode, setActiveQuizMode] = useState("normal");
  const [activeQuizIsMistakeReview, setActiveQuizIsMistakeReview] = useState(false);
  const [lastQuizMistakeKeys, setLastQuizMistakeKeys] = useState(() => {
    const saved = localStorage.getItem("vocab_last_quiz_mistakes");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [lastQuizMistakeKeysByBook, setLastQuizMistakeKeysByBook] = useState(() => {
    const saved = localStorage.getItem("vocab_last_quiz_mistakes_by_book");
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const next = {};
      Object.entries(parsed).forEach(([bookId, keys]) => {
        if (!Array.isArray(keys)) return;
        next[String(bookId)] = keys.filter((item) => typeof item === "string");
      });
      return next;
    } catch {
      return {};
    }
  });
  const [lastQuizMistakeMode, setLastQuizMistakeMode] = useState(() => {
    const saved = localStorage.getItem("vocab_last_quiz_mistake_mode");
    return normalizeQuizMode(saved, "normal");
  });
  const [lastQuizMistakeModeByBook, setLastQuizMistakeModeByBook] = useState(() => {
    const saved = localStorage.getItem("vocab_last_quiz_mistake_mode_by_book");
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const next = {};
      Object.entries(parsed).forEach(([bookId, mode]) => {
        next[String(bookId)] = normalizeQuizMode(mode, "normal");
      });
      return next;
    } catch {
      return {};
    }
  });
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);
  const [isCoinInfoOpen, setIsCoinInfoOpen] = useState(false);
  const [editingDefinitionKey, setEditingDefinitionKey] = useState("");
  const [editingDefinitionDraft, setEditingDefinitionDraft] = useState("");
  const [expandedExamplesKey, setExpandedExamplesKey] = useState("");
  const [difficultyInfoWord, setDifficultyInfoWord] = useState("");
  const [selectedChapterIdForNewWords, setSelectedChapterIdForNewWords] = useState(DEFAULT_CHAPTER_ID);
  const [newChapterName, setNewChapterName] = useState("");
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    const saved = localStorage.getItem("vocab_sidebar_hidden");
    return Boolean(parseJsonSafely(saved, false));
  });
  const [weeklyStats, setWeeklyStats] = useState(() => {
    const saved = localStorage.getItem("vocab_weekly_stats");
    return parseStoredWeeklyStats(saved);
  });
  const [activityHistory, setActivityHistory] = useState(() => {
    const saved = localStorage.getItem("vocab_activity_history");
    return parseStoredActivityHistory(saved);
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "");
  const [authUsername, setAuthUsername] = useState(
    () => localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || ""
  );
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCloudStateHydrated, setIsCloudStateHydrated] = useState(false);
  const modalRef = useRef(null);
  const coinInfoRef = useRef(null);
  const levelInfoRef = useRef(null);
  const sidebarRef = useRef(null);
  const backupFileInputRef = useRef(null);
  const pronunciationFetchInFlightRef = useRef(new Set());
  const sessionStartedAtRef = useRef(Date.now());
  const lastUserActivityAtRef = useRef(Date.now());
  const pendingMistakeReviewSourceRef = useRef(null);

  const currentBook = books.find((b) => b.id === currentBookId);
  const currentBookChapters = getBookChapterList(currentBook);
  const fallbackChapterId = currentBookChapters[0]?.id || DEFAULT_CHAPTER_ID;
  const safeSelectedChapterIdForNewWords = currentBookChapters.some(
    (chapter) => chapter.id === selectedChapterIdForNewWords
  )
    ? selectedChapterIdForNewWords
    : fallbackChapterId;
  const level = getLevelFromXp(xp);
  const xpProgress = getXpProgress(xp);
  const xpToNextLevel = getXpToNextLevel(xp);
  const xpRemainingToNextLevel = Math.max(xpToNextLevel - xpProgress, 0);
  const xpMultiplier = isEconomyEnabled && isLevelsEnabled ? 1 + (marketLevels?.xp_boost ?? 0) * 0.1 : 1;
  const wordCoinBonus = isEconomyEnabled ? marketLevels?.word_coin_bonus ?? 0 : 0;
  const currentWordXpGain = Math.max(1, Math.round(getWordXpGain(streak.count) * xpMultiplier));
  const currentWordCoinGain = getWordCoinGain(streak.count) + wordCoinBonus;
  const upcomingLevels = [level + 1, level + 2, level + 3].map((targetLevel) => ({
    level: targetLevel,
    requiredXp: getXpRequiredForLevel(targetLevel),
  }));
  const sortedBooksByRecent = [...books].sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0));
  const pinnedBooks = sortedBooksByRecent.filter((book) => Boolean(book.pinned));
  const unpinnedBooks = sortedBooksByRecent.filter((book) => !book.pinned);
  const quickAccessBooks = [...pinnedBooks, ...unpinnedBooks];
  const sidebarBookShortcuts = quickAccessBooks.slice(0, 6);
  const currentWeekStats = ensureCurrentWeekStats(weeklyStats);
  const weeklyTimeSpent = formatWeeklyTime(currentWeekStats.timeSpentSeconds);
  const activityDailyStats = getRecentPeriodTotals(activityHistory, 1);
  const activityWeeklyStats = getRecentPeriodTotals(activityHistory, 7);
  const activityMonthlyStats = getMonthTotals(activityHistory);
  const activityTotalStats = sumActivityHistory(activityHistory);
  const definitionTrend = buildDefinitionTrend(activityHistory, 14);
  const wordTrend = definitionTrend.map((item) => ({
    ...item,
    value: Math.max(0, Math.floor(Number(activityHistory?.[item.key]?.wordsAdded) || 0)),
  }));
  const questionTrend = definitionTrend.map((item) => ({
    ...item,
    value: Math.max(0, Math.floor(Number(activityHistory?.[item.key]?.questionsCompleted) || 0)),
  }));
  const maxTrendValue = Math.max(1, ...wordTrend.map((item) => item.value));
  const maxQuestionTrendValue = Math.max(1, ...questionTrend.map((item) => item.value));
  const difficultyWordCounts = WORD_DIFFICULTY_OPTIONS.map((option) => ({
    ...option,
    count: books.reduce((total, book) => {
      const words = Array.isArray(book.words) ? book.words : [];
      const wordsForLevel = words.reduce((wordTotal, wordEntry) => {
        if (normalizeWordDifficulty(wordEntry?.difficulty) !== option.value) return wordTotal;
        return wordTotal + 1;
      }, 0);
      return total + wordsForLevel;
    }, 0),
  }));
  const maxDifficultyWordCount = Math.max(
    1,
    ...difficultyWordCounts.map((item) => item.count)
  );
  const masteryLevelCounts = [
    { level: 1, label: "Learned", count: 0 },
    { level: 2, label: "Familiar", count: 0 },
    { level: 3, label: "Strong", count: 0 },
    { level: 4, label: "Mastered", count: 0 },
  ].map((item) => ({
    ...item,
    count: books.reduce((total, book) => {
      const words = Array.isArray(book.words) ? book.words : [];
      const wordsForLevel = words.reduce((wordTotal, wordEntry) => {
        if (getWordMasteryMeta(wordEntry).level !== item.level) return wordTotal;
        return wordTotal + 1;
      }, 0);
      return total + wordsForLevel;
    }, 0),
  }));
  const maxMasteryWordCount = Math.max(1, ...masteryLevelCounts.map((item) => item.count));
  const quizSetupBooks = books.filter((book) => quizSetupSelection.bookIds.includes(String(book.id)));
  const quizSetupChapterKeySet = new Set(quizSetupSelection.chapterKeys);
  const quizSetupDifficultyKeySet = new Set(quizSetupSelection.difficultyKeys);
  const lastQuizMistakeKeySet = new Set(lastQuizMistakeKeys);
  const quizSetupWords = quizSetupBooks.flatMap((book) =>
    (book.words || [])
      .filter((wordEntry) => {
        const chapterKey = `${book.id}:${wordEntry.chapterId}`;
        if (!quizSetupChapterKeySet.has(chapterKey)) return false;

        const normalizedDifficulty = normalizeWordDifficulty(wordEntry?.difficulty);
        const difficultyKey = normalizedDifficulty || "unassigned";
        if (!quizSetupDifficultyKeySet.has(difficultyKey)) return false;

        if (quizMode === "mistake") {
          const mistakeKey = getWordSessionKey(book.id, wordEntry.chapterId, wordEntry.word);
          return lastQuizMistakeKeySet.has(mistakeKey);
        }

        return true;
      })
      .map((wordEntry) => ({
        ...wordEntry,
        sourceBookId: book.id,
      }))
  );

  function startQuizSession() {
    const nextTitle =
      quizSetupSelection.bookIds.length === 1
        ? books.find((book) => String(book.id) === quizSetupSelection.bookIds[0])?.name || "Quiz"
        : "Multi-Book Quiz";
    setActiveQuizWords(quizSetupWords);
    setActiveQuizTitle(nextTitle);
    setActiveQuizMode(normalizeQuizMode(quizMode, "normal"));
    setActiveQuizIsMistakeReview(false);
    setScreen("quiz");
  }

  function startMistakeReviewSession(source = "global") {
    const isBookSource = source === "book";
    const targetBookId = isBookSource ? String(currentBookId ?? "") : "";
    const scopedKeys = isBookSource
      ? (lastQuizMistakeKeysByBook[targetBookId] || [])
      : lastQuizMistakeKeys;
    const scopedKeySet = new Set(scopedKeys);

    const wordsForReview = books.flatMap((book) =>
      (book.words || [])
        .filter((wordEntry) =>
          scopedKeySet.has(getWordSessionKey(book.id, wordEntry.chapterId, wordEntry.word))
        )
        .map((wordEntry) => ({
          ...wordEntry,
          sourceBookId: book.id,
        }))
    );

    const nextTitle = isBookSource
      ? `${books.find((book) => String(book.id) === targetBookId)?.name || "Book"} Mistake Review`
      : "Mistake Review";
    const reviewMode = isBookSource
      ? normalizeQuizMode(lastQuizMistakeModeByBook[targetBookId], "normal")
      : normalizeQuizMode(lastQuizMistakeMode, "normal");

    setActiveQuizWords(wordsForReview);
    setActiveQuizTitle(nextTitle);
    setActiveQuizMode(reviewMode);
    setActiveQuizIsMistakeReview(true);
    pendingMistakeReviewSourceRef.current = null;
    setScreen("mistakeReview");
  }

  function requestMistakeReview(source = "global") {
    pendingMistakeReviewSourceRef.current = source;
    startMistakeReviewSession(source);
  }

  function renderWithSidebar(content) {
    const inDefinitions =
      screen === "definitions" || screen === "definitionsSelect" || screen === "chapters";
    const inFlashcards = screen === "flashcards" || screen === "flashcardsSelect";
    const inQuiz = screen === "quiz" || screen === "quizSelect";
    const inMistakeReview = screen === "mistakeReview";

    return (
      <div className="appShell">
        <aside ref={sidebarRef} className={`sidebar ${isSidebarHidden ? "isCollapsed" : ""}`}>
          <div className="sidebarTopRow">
            {!isSidebarHidden && (
              <div className="sidebarBrandWrap">
                <div className="sidebarBrand">Vocalibry</div>
                {IS_BETA_BUILD && <span className="betaPill">Beta</span>}
              </div>
            )}
            <button
              type="button"
              className="sidebarToggleBtn"
              onClick={() => setIsSidebarHidden((prev) => !prev)}
              aria-label={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
            >
              {theme === "dark" ? (
                <svg
                  className="sidebarToggleLogo"
                  viewBox="8 14 174 102"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false" preserveAspectRatio="xMidYMid meet"
                >
                  <path d="M22 36h20l31 69h-20z" fill="#ffffff" />
                  <path d="M74 106h68c4.3 0 8.1-2.8 9.4-6.9l20-63c2-6.4-2.7-13.1-9.4-13.1H91z" fill="#e6e6e6" />
                </svg>
              ) : (
                <svg
                  className="sidebarToggleLogo"
                  viewBox="8 14 174 102"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false" preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient id="sidebarToggleGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#12b9ff" />
                      <stop offset="45%" stopColor="#0a7ed9" />
                      <stop offset="100%" stopColor="#230067" />
                    </linearGradient>
                  </defs>
                  <path d="M22 36h20l31 69h-20z" fill="url(#sidebarToggleGradient)" />
                  <path d="M74 106h68c4.3 0 8.1-2.8 9.4-6.9l20-63c2-6.4-2.7-13.1-9.4-13.1H91z" fill="url(#sidebarToggleGradient)" />
                </svg>
              )}
            </button>
          </div>

          <div className="sidebarContent" aria-hidden={isSidebarHidden}>
            <nav className="sidebarNav" aria-label="Main navigation">
              <button
                type="button"
                className={`sidebarNavBtn ${screen === "dashboard" ? "isActive" : ""}`}
                onClick={() => setScreen("dashboard")}
              >
                <span className="sidebarNavBtnLabel">Dashboard</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83C\uDFE0"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${screen === "books" ? "isActive" : ""}`}
                onClick={() => setScreen("books")}
              >
                <span className="sidebarNavBtnLabel">My Books</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDCDA"}</span>
              </button>
              {isEconomyEnabled && (
                <button
                  type="button"
                  className={`sidebarNavBtn ${screen === "market" ? "isActive" : ""}`}
                  onClick={() => setScreen("market")}
                >
                  <span className="sidebarNavBtnLabel">Market</span>
                  <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDED2"}</span>
                </button>
              )}
              <button
                type="button"
                className={`sidebarNavBtn ${screen === "data" ? "isActive" : ""}`}
                onClick={() => setScreen("data")}
              >
                <span className="sidebarNavBtnLabel">Data</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDCCA"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inDefinitions ? "isActive" : ""}`}
                onClick={() => setScreen("definitionsSelect")}
              >
                <span className="sidebarNavBtnLabel">Definitions</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83E\uDDE0"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inFlashcards ? "isActive" : ""}`}
                onClick={() => setScreen("flashcardsSelect")}
              >
                <span className="sidebarNavBtnLabel">Flashcards</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\u26A1"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inQuiz ? "isActive" : ""}`}
                onClick={() => {
                  setQuizBackScreen("quizSelect");
                  setQuizMode("normal");
                  initializeQuizSetupSelection();
                  setScreen("quizSelect");
                }}
              >
                <span className="sidebarNavBtnLabel">Quiz</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\u2705"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inMistakeReview ? "isActive" : ""}`}
                onClick={() => {
                  setQuizBackScreen("dashboard");
                  requestMistakeReview("global");
                }}
              >
                <span className="sidebarNavBtnLabel">Mistake Review</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDD01"}</span>
              </button>
            </nav>

            <div className="sidebarSection">
              <p className="sidebarSectionTitle">Recent Books</p>
              <div className="sidebarBooks">
                {sidebarBookShortcuts.length === 0 ? (
                  <p className="sidebarEmptyText">No books yet</p>
                ) : (
                  sidebarBookShortcuts.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className={`sidebarBookBtn ${currentBookId === book.id ? "isActive" : ""}`}
                      onClick={() => {
                        setCurrentBookId(book.id);
                        setScreen("bookMenu");
                      }}
                    >
                      {book.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="sidebarSection">
              <p className="sidebarSectionTitle">Settings</p>
              <div className="sidebarBooks">
                <button
                  type="button"
                  className={`sidebarNavBtn ${screen === "settings" ? "isActive" : ""}`}
                  onClick={() => setScreen("settings")}
                >
                  <span className="sidebarNavBtnLabel">Settings</span>
                  <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\u2699\uFE0F"}</span>
                </button>
                <button
                  type="button"
                  className={`sidebarNavBtn ${screen === "account" ? "isActive" : ""}`}
                  onClick={() => setScreen("account")}
                >
                  <span className="sidebarNavBtnLabel">My Account</span>
                  <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDC64"}</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
        <main className="appMain">{content}</main>
      </div>
    );
  }

  useEffect(() => {
    if (!isSidebarHidden) return;
    if (!sidebarRef.current) return;
    sidebarRef.current.scrollTop = 0;
  }, [isSidebarHidden]);

  useEffect(() => {
    const persistedState = {
      vocab_books: JSON.stringify(books),
      vocab_xp: JSON.stringify(xp),
      vocab_coins: JSON.stringify(coins),
      vocab_market_levels: JSON.stringify(marketLevels),
      vocab_economy_enabled: String(isEconomyEnabled),
      vocab_levels_enabled: String(isLevelsEnabled),
      vocab_theme: theme,
      vocab_sidebar_hidden: JSON.stringify(isSidebarHidden),
      vocab_weekly_stats: JSON.stringify(weeklyStats),
      vocab_activity_history: JSON.stringify(activityHistory),
      vocab_last_quiz_mistakes: JSON.stringify(lastQuizMistakeKeys),
      vocab_last_quiz_mistakes_by_book: JSON.stringify(lastQuizMistakeKeysByBook),
      vocab_last_quiz_mistake_mode: lastQuizMistakeMode,
      vocab_last_quiz_mistake_mode_by_book: JSON.stringify(lastQuizMistakeModeByBook),
      vocab_streak: JSON.stringify(streak),
      [AUTH_TOKEN_STORAGE_KEY]: authToken,
      [AUTH_USERNAME_STORAGE_KEY]: authUsername,
    };

    Object.entries(persistedState).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }, [
    books,
    xp,
    coins,
    marketLevels,
    isEconomyEnabled,
    isLevelsEnabled,
    theme,
    isSidebarHidden,
    weeklyStats,
    activityHistory,
    lastQuizMistakeKeys,
    lastQuizMistakeKeysByBook,
    lastQuizMistakeMode,
    lastQuizMistakeModeByBook,
    streak,
    authToken,
    authUsername,
  ]);

  async function submitAuth(mode) {
    const username = String(authForm.username || "")
      .trim()
      .toLowerCase();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");

    if (!username || !password) {
      setAuthError("Username and password are required.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      const endpoint = mode === "register" ? "register" : "login";
      const response = await fetch(`${AUTH_API_PATH}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "");
        const nextError =
          backendError === "invalid-username"
            ? "Use 3-24 chars: lowercase letters, numbers, underscore."
            : backendError === "weak-password"
              ? "Password must be at least 8 characters."
              : backendError === "username-taken"
                ? "That username is already taken."
                : backendError === "invalid-credentials"
                  ? "Incorrect username or password."
                  : "Could not sign in. Please try again.";
        setAuthError(nextError);
        return;
      }

      const nextToken = String(payload?.token || "").trim();
      const nextUsername = String(payload?.username || username).trim().toLowerCase();
      if (!nextToken) {
        setAuthError("Auth token was not returned by the server.");
        return;
      }

      setAuthToken(nextToken);
      setAuthUsername(nextUsername);
      setAuthForm({ username: "", password: "", confirmPassword: "" });
      openNoticeModal(`Signed in as ${nextUsername}.`, "Account Ready");
    } catch {
      setAuthError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function logoutAccount() {
    setAuthToken("");
    setAuthUsername("");
    setAuthError("");
    setAuthForm({ username: "", password: "", confirmPassword: "" });
    setIsCloudStateHydrated(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrateCloudState() {
      if (!authToken) {
        setIsCloudStateHydrated(false);
        return;
      }

      try {
        const response = await fetch(STATE_API_PATH, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.status === 401) {
          if (!cancelled) {
            setAuthToken("");
            setAuthUsername("");
            setAuthError("Your session expired. Please log in again.");
          }
          return;
        }

        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled) return;

        const rawState =
          payload?.appState && typeof payload.appState === "object" && !Array.isArray(payload.appState)
            ? payload.appState
            : null;
        const stateData =
          rawState?.data && typeof rawState.data === "object" && !Array.isArray(rawState.data)
            ? rawState.data
            : rawState;

        if (stateData) {
          applyAppDataSnapshot(stateData);
        }
      } catch {
        // Keep local state when cloud sync is unavailable.
      } finally {
        if (!cancelled) setIsCloudStateHydrated(true);
      }
    }

    hydrateCloudState();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !isCloudStateHydrated) return undefined;

    const timeoutId = window.setTimeout(() => {
      fetch(STATE_API_PATH, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          appState: buildBackupSnapshot(),
        }),
      }).catch(() => {
        // Keep app fully usable even if cloud save fails.
      });
    }, CLOUD_STATE_SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    authToken,
    isCloudStateHydrated,
    theme,
    books,
    streak,
    xp,
    coins,
    isEconomyEnabled,
    isLevelsEnabled,
    marketLevels,
    isSidebarHidden,
    weeklyStats,
    activityHistory,
    lastQuizMistakeKeys,
    lastQuizMistakeKeysByBook,
    lastQuizMistakeMode,
    lastQuizMistakeModeByBook,
  ]);

  useEffect(() => {
    if (authToken) return;
    setIsCloudStateHydrated(false);
  }, [authToken]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (isEconomyEnabled) return;
    setIsCoinInfoOpen(false);
    if (screen === "market") {
      setScreen("dashboard");
    }
  }, [isEconomyEnabled, screen]);

  useEffect(() => {
    if (isLevelsEnabled) return;
    setIsLevelInfoOpen(false);
  }, [isLevelsEnabled]);

  useEffect(() => {
    const flushActiveTime = ({ ignoreVisibility = false } = {}) => {
      const now = Date.now();
      const activeWindowEnd = lastUserActivityAtRef.current + INACTIVITY_TIMEOUT_MS;
      const effectiveNow = Math.min(now, activeWindowEnd);
      const elapsedMs = effectiveNow - sessionStartedAtRef.current;
      sessionStartedAtRef.current = now;

      if (!ignoreVisibility && document.visibilityState !== "visible") return;
      if (now - lastUserActivityAtRef.current >= INACTIVITY_TIMEOUT_MS) return;

      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      if (elapsedSeconds <= 0) return;

      setWeeklyStats((prev) => {
        const current = ensureCurrentWeekStats(prev);
        return {
          ...current,
          timeSpentSeconds: current.timeSpentSeconds + elapsedSeconds,
        };
      });
      setActivityHistory((prev) =>
        mergeActivityDelta(prev, {
          definitionsAdded: 0,
          wordsAdded: 0,
          questionsCompleted: 0,
          timeSpentSeconds: elapsedSeconds,
        })
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushActiveTime({ ignoreVisibility: true });
        return;
      }

      const now = Date.now();
      sessionStartedAtRef.current = now;
      lastUserActivityAtRef.current = now;
      setWeeklyStats((prev) => ensureCurrentWeekStats(prev));
    };

    const markActivity = () => {
      const now = Date.now();
      const wasInactive = now - lastUserActivityAtRef.current >= INACTIVITY_TIMEOUT_MS;
      lastUserActivityAtRef.current = now;
      if (wasInactive) {
        sessionStartedAtRef.current = now;
      }
    };

    const beforeUnloadHandler = () => flushActiveTime({ ignoreVisibility: true });
    const intervalId = window.setInterval(flushActiveTime, 30000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", beforeUnloadHandler);
    window.addEventListener("pointerdown", markActivity, { passive: true });
    window.addEventListener("keydown", markActivity, { passive: true });
    window.addEventListener("mousemove", markActivity, { passive: true });
    window.addEventListener("scroll", markActivity, { passive: true });
    window.addEventListener("focus", markActivity, { passive: true });
    window.addEventListener("touchstart", markActivity, { passive: true });

    return () => {
      flushActiveTime({ ignoreVisibility: true });
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      window.removeEventListener("pointerdown", markActivity);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("mousemove", markActivity);
      window.removeEventListener("scroll", markActivity);
      window.removeEventListener("focus", markActivity);
      window.removeEventListener("touchstart", markActivity);
    };
  }, []);

  useEffect(() => {
    setEditingDefinitionKey("");
    setEditingDefinitionDraft("");
    setExpandedExamplesKey("");
    setDifficultyInfoWord("");
    setNewChapterName("");
    setSelectedChapterIdForNewWords(fallbackChapterId);
  }, [currentBookId, screen]);

  useEffect(() => {
    setBooks((prevBooks) => {
      let hasChanges = false;

      const nextBooks = prevBooks.map((book) => {
        let bookChanged = false;
        const nextWords = (book.words || []).map((wordEntry) => {
          const currentDifficulty = normalizeWordDifficulty(wordEntry?.difficulty);
          if (currentDifficulty) return wordEntry;

          const estimatedDifficulty = estimateCefrLevel(wordEntry?.word);
          if (!estimatedDifficulty) return wordEntry;

          bookChanged = true;
          hasChanges = true;
          return {
            ...wordEntry,
            difficulty: estimatedDifficulty,
          };
        });

        if (!bookChanged) return book;
        return {
          ...book,
          words: nextWords,
        };
      });

      return hasChanges ? nextBooks : prevBooks;
    });
  }, []);

  useEffect(() => {
    if (screen !== "quizSelect") return;
    if (pendingMistakeReviewSourceRef.current) {
      const source = pendingMistakeReviewSourceRef.current;
      startMistakeReviewSession(source);
      return;
    }
    if (quizMode === "mistake") {
      startMistakeReviewSession(quizBackScreen === "bookMenu" ? "book" : "global");
      return;
    }

    const allBookIds = books.map((book) => String(book.id));
    const allChapterKeys = books.flatMap((book) =>
      getBookChapterList(book).map((chapter) => `${book.id}:${chapter.id}`)
    );
    const allDifficultyKeys = ["unassigned", ...WORD_DIFFICULTY_OPTIONS.map((option) => option.value)];
    const validBookIds = new Set(allBookIds);
    const validChapterKeys = new Set(allChapterKeys);
    const validDifficultyKeys = new Set(allDifficultyKeys);

    setQuizSetupSelection((prev) => {
      const nextBookIds = prev.bookIds.filter((id) => validBookIds.has(id));
      const nextChapterKeys = prev.chapterKeys.filter((key) => validChapterKeys.has(key));
      const nextDifficultyKeys = prev.difficultyKeys.filter((key) => validDifficultyKeys.has(key));
      const finalSelection = {
        bookIds: nextBookIds,
        chapterKeys: nextChapterKeys,
        difficultyKeys: nextDifficultyKeys,
      };

      if (
        areStringArraysEqual(prev.bookIds, finalSelection.bookIds) &&
        areStringArraysEqual(prev.chapterKeys, finalSelection.chapterKeys) &&
        areStringArraysEqual(prev.difficultyKeys, finalSelection.difficultyKeys)
      ) {
        return prev;
      }

      return finalSelection;
    });
  }, [screen, books, quizMode, quizBackScreen]);

  useEffect(() => {
    if (screen !== "definitions" || !currentBook) return;

    const wordsMissingPronunciation = (currentBook.words || []).filter((wordEntry) => {
      const existing = String(
        wordEntry?.pronunciation || wordEntry?.pronounciation || ""
      ).trim();
      return !existing && String(wordEntry?.word || "").trim();
    });

    if (!wordsMissingPronunciation.length) return;

    let cancelled = false;

    const backfillPronunciations = async () => {
      for (const wordEntry of wordsMissingPronunciation) {
        const word = String(wordEntry.word || "").trim();
        if (!word) continue;

        const fetchKey = `${currentBook.id}:${word.toLowerCase()}`;
        if (pronunciationFetchInFlightRef.current.has(fetchKey)) continue;

        pronunciationFetchInFlightRef.current.add(fetchKey);

        try {
          const res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
          );
          if (!res.ok) continue;

          const data = await res.json();
          const pronunciation = extractPronunciation(data);
          if (!pronunciation || cancelled) continue;

          setBooks((prevBooks) =>
            prevBooks.map((book) => {
              if (book.id !== currentBook.id) return book;

              return {
                ...book,
                words: book.words.map((w) =>
                  w.word === word && !String(w.pronunciation || w.pronounciation || "").trim()
                    ? { ...w, pronunciation }
                    : w
                ),
              };
            })
          );
        } catch {
          // Ignore backfill errors and keep the Definitions page responsive.
        } finally {
          pronunciationFetchInFlightRef.current.delete(fetchKey);
        }
      }
    };

    backfillPronunciations();

    return () => {
      cancelled = true;
    };
  }, [screen, currentBook, setBooks]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;

      if (isCoinInfoOpen && coinInfoRef.current && !coinInfoRef.current.contains(target)) {
        setIsCoinInfoOpen(false);
      }

      if (isLevelInfoOpen && levelInfoRef.current && !levelInfoRef.current.contains(target)) {
        setIsLevelInfoOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCoinInfoOpen, isLevelInfoOpen]);

  // Streak logic
  function updateStreak() {
    const today = new Date().toDateString();
    if (!streak.lastDate) {
      const newStreak = { count: 1, lastDate: today };
      setStreak(newStreak);
      return;
    }
    const last = new Date(streak.lastDate);
    const diff = (new Date(today) - last) / (1000 * 60 * 60 * 24);
    let newCount = streak.count;
    if (diff === 1) newCount += 1;
    else if (diff > 1) newCount = 1;
    const newStreak = { count: newCount, lastDate: today };
    setStreak(newStreak);
  }

  // Add / delete books
  function openAddBookModal() {
    setNewBookName("");
    setIsAddBookModalOpen(true);
  }

  function createBook() {
    const name = newBookName.trim();
    if (!name) return;
    const newBook = {
      id: Date.now(),
      name,
      words: [],
      chapters: [createDefaultChapter()],
      questionsCompleted: 0,
      lastOpened: Date.now(),
    };
    setBooks([...books, newBook]);
    setIsAddBookModalOpen(false);
    setNewBookName("");
  }

  function addChapter() {
    if (!currentBook) return;
    const chapterName = newChapterName.trim();
    if (!chapterName) return;

    const duplicate = currentBookChapters.some(
      (chapter) => chapter.name.toLowerCase() === chapterName.toLowerCase()
    );
    if (duplicate) {
      openNoticeModal("That chapter already exists.", "Duplicate Chapter");
      return;
    }

    const baseSlug = sanitizeChapterId(chapterName) || "chapter";
    let chapterId = baseSlug;
    let suffix = 2;
    const existingIds = new Set(currentBookChapters.map((chapter) => chapter.id));
    while (existingIds.has(chapterId)) {
      chapterId = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        book.id !== currentBookId
          ? book
          : {
              ...book,
              chapters: [...currentBookChapters, { id: chapterId, name: chapterName }],
            }
      )
    );

    setSelectedChapterIdForNewWords(chapterId);
    setNewChapterName("");
  }

  function deleteChapter(chapterIdToDelete) {
    if (!currentBook) return;
    if (currentBookChapters.length <= 1) {
      openNoticeModal("You need at least one chapter.", "Cannot Delete Chapter");
      return;
    }

    const remainingChapters = currentBookChapters.filter((chapter) => chapter.id !== chapterIdToDelete);
    const reassignedChapterId = remainingChapters[0]?.id || DEFAULT_CHAPTER_ID;

    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (book.id !== currentBookId) return book;
        return {
          ...book,
          chapters: remainingChapters,
          words: (book.words || []).map((wordEntry) =>
            wordEntry.chapterId === chapterIdToDelete
              ? { ...wordEntry, chapterId: reassignedChapterId }
              : wordEntry
          ),
        };
      })
    );

    if (safeSelectedChapterIdForNewWords === chapterIdToDelete) {
      setSelectedChapterIdForNewWords(reassignedChapterId);
    }
  }

  function updateWordChapter(wordToUpdate, chapterId) {
    if (!currentBook) return;
    const safeChapterId = currentBookChapters.some((chapter) => chapter.id === chapterId)
      ? chapterId
      : fallbackChapterId;

    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (book.id !== currentBookId) return book;
        return {
          ...book,
          words: book.words.map((wordEntry) =>
            wordEntry.word === wordToUpdate
              ? {
                  ...wordEntry,
                  chapterId: safeChapterId,
                }
              : wordEntry
          ),
        };
      })
    );
  }

  function deleteBook(id) {
    setBooks(books.filter((b) => b.id !== id));
  }

  function askDeleteBook(book) {
    setBookPendingDelete(book);
  }

  function togglePinBook(bookId) {
    const targetBook = books.find((book) => book.id === bookId);
    if (!targetBook) return;

    if (!targetBook.pinned) {
      const pinnedCount = books.filter((book) => book.pinned).length;
      if (pinnedCount >= 2) {
        openNoticeModal("You can pin up to 2 books.", "Pin Limit Reached");
        return;
      }
    }

    setBooks(
      books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              pinned: !book.pinned,
            }
          : book
      )
    );
  }

  function confirmDeleteBook() {
    if (!bookPendingDelete) return;
    deleteBook(bookPendingDelete.id);
    setBookPendingDelete(null);
  }

  function askDeleteChapter(chapter) {
    if (!chapter) return;
    setChapterPendingDelete(chapter);
  }

  function confirmDeleteChapter() {
    if (!chapterPendingDelete) return;
    deleteChapter(chapterPendingDelete.id);
    setChapterPendingDelete(null);
  }

  function openNoticeModal(message, title = "Notice") {
    setNoticeModal({ title, message });
  }

  function applyAppDataSnapshot(rawData, { screenAfterApply = null } = {}) {
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      throw new Error("invalid-app-state-shape");
    }

    const importedBooks = normalizeBooksData(rawData.books);
    const importedTheme = rawData.theme === "dark" || rawData.theme === "light" ? rawData.theme : "light";
    const importedStreak = {
      count: Math.max(1, Math.floor(Number(rawData?.streak?.count) || 1)),
      lastDate: rawData?.streak?.lastDate ? String(rawData.streak.lastDate) : null,
    };
    const importedXp = Math.max(0, Math.floor(Number(rawData?.xp) || 0));
    const importedCoins = Math.max(0, Math.floor(Number(rawData?.coins) || 0));
    const importedIsEconomyEnabled = parseStoredBoolean(rawData?.isEconomyEnabled, true);
    const importedIsLevelsEnabled = parseStoredBoolean(rawData?.isLevelsEnabled, true);
    const importedMarketLevels = parseStoredMarketLevels(JSON.stringify(rawData?.marketLevels || {}));
    const importedSidebarHidden = parseStoredBoolean(rawData?.isSidebarHidden, false);
    const importedWeeklyStats = parseStoredWeeklyStats(JSON.stringify(rawData?.weeklyStats || null));
    const importedActivityHistory = parseStoredActivityHistory(
      JSON.stringify(rawData?.activityHistory || {})
    );
    const importedLastQuizMistakeKeys = Array.isArray(rawData?.lastQuizMistakeKeys)
      ? rawData.lastQuizMistakeKeys.filter((item) => typeof item === "string")
      : [];
    const importedLastQuizMistakeKeysByBook = {};
    if (
      rawData?.lastQuizMistakeKeysByBook &&
      typeof rawData.lastQuizMistakeKeysByBook === "object" &&
      !Array.isArray(rawData.lastQuizMistakeKeysByBook)
    ) {
      Object.entries(rawData.lastQuizMistakeKeysByBook).forEach(([bookId, keys]) => {
        if (!Array.isArray(keys)) return;
        importedLastQuizMistakeKeysByBook[String(bookId)] = keys.filter((item) => typeof item === "string");
      });
    }
    const importedLastQuizMistakeMode = normalizeQuizMode(rawData?.lastQuizMistakeMode, "normal");
    const importedLastQuizMistakeModeByBook = {};
    if (
      rawData?.lastQuizMistakeModeByBook &&
      typeof rawData.lastQuizMistakeModeByBook === "object" &&
      !Array.isArray(rawData.lastQuizMistakeModeByBook)
    ) {
      Object.entries(rawData.lastQuizMistakeModeByBook).forEach(([bookId, mode]) => {
        importedLastQuizMistakeModeByBook[String(bookId)] = normalizeQuizMode(mode, "normal");
      });
    }

    setTheme(importedTheme);
    setBooks(importedBooks);
    setStreak(importedStreak);
    setXp(importedXp);
    setCoins(importedCoins);
    setIsEconomyEnabled(importedIsEconomyEnabled);
    setIsLevelsEnabled(importedIsLevelsEnabled);
    setMarketLevels(importedMarketLevels);
    setIsSidebarHidden(importedSidebarHidden);
    setWeeklyStats(importedWeeklyStats);
    setActivityHistory(importedActivityHistory);
    setLastQuizMistakeKeys(importedLastQuizMistakeKeys);
    setLastQuizMistakeKeysByBook(importedLastQuizMistakeKeysByBook);
    setLastQuizMistakeMode(importedLastQuizMistakeMode);
    setLastQuizMistakeModeByBook(importedLastQuizMistakeModeByBook);
    setCurrentBookId((prev) => (importedBooks.some((book) => book.id === prev) ? prev : importedBooks[0]?.id ?? null));
    if (screenAfterApply) setScreen(screenAfterApply);
  }

  function buildBackupSnapshot() {
    return {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        theme,
        books,
        streak,
        xp,
        coins,
        isEconomyEnabled,
        isLevelsEnabled,
        marketLevels,
        isSidebarHidden,
        weeklyStats,
        activityHistory,
        lastQuizMistakeKeys,
        lastQuizMistakeKeysByBook,
        lastQuizMistakeMode,
        lastQuizMistakeModeByBook,
      },
    };
  }

  function exportBackup() {
    try {
      const snapshot = buildBackupSnapshot();
      const dateStamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vocab-backup-${dateStamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      openNoticeModal("Backup exported successfully.", "Export Complete");
    } catch {
      openNoticeModal("Could not export backup. Please try again.", "Export Failed");
    }
  }

  async function importBackup(event) {
    const file = event?.target?.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const rawData =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.data
          ? parsed.data
          : parsed;

      if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
        throw new Error("invalid-backup-shape");
      }
      applyAppDataSnapshot(rawData, { screenAfterApply: "data" });
      openNoticeModal("Backup imported successfully.", "Import Complete");
    } catch {
      openNoticeModal("Invalid backup file. Please use a valid JSON backup.", "Import Failed");
    }
  }

  useEffect(() => {
    const isModalOpen =
      isAddBookModalOpen ||
      Boolean(bookPendingDelete) ||
      Boolean(chapterPendingDelete) ||
      Boolean(noticeModal);
    if (!isModalOpen) return;

    const closeModal = () => {
      if (isAddBookModalOpen) setIsAddBookModalOpen(false);
      if (bookPendingDelete) setBookPendingDelete(null);
      if (chapterPendingDelete) setChapterPendingDelete(null);
      if (noticeModal) setNoticeModal(null);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isAddBookModalOpen, bookPendingDelete, chapterPendingDelete, noticeModal]);

  function renderModal() {
    if (isAddBookModalOpen) {
      return (
        <div className="modalOverlay" onClick={() => setIsAddBookModalOpen(false)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-book-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-book-title">Create Book</h3>
            <input
              value={newBookName}
              onChange={(e) => setNewBookName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBook()}
              placeholder="Enter book name"
              autoFocus
            />
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setIsAddBookModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="modalBtn primary"
                onClick={createBook}
                disabled={!newBookName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (bookPendingDelete) {
      return (
        <div className="modalOverlay" onClick={() => setBookPendingDelete(null)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-book-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-book-title">Delete Book</h3>
            <p>Delete "{bookPendingDelete.name}"?</p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setBookPendingDelete(null)}>
                Cancel
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmDeleteBook}>
                Delete
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (chapterPendingDelete) {
      return (
        <div className="modalOverlay" onClick={() => setChapterPendingDelete(null)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chapter-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-chapter-title">Delete Chapter</h3>
            <p>Delete "{chapterPendingDelete.name}"?</p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setChapterPendingDelete(null)}>
                Cancel
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmDeleteChapter}>
                Delete
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (noticeModal) {
      return (
        <div className="modalOverlay" onClick={() => setNoticeModal(null)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="notice-modal-title">{noticeModal.title || "Notice"}</h3>
            <p>{noticeModal.message || ""}</p>
            <div className="modalActions">
              <button type="button" className="modalBtn primary" onClick={() => setNoticeModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  function renderSelectBookCard(book, onSelect) {
    const words = book?.words || [];
    const questionsCompleted = Math.max(0, Math.floor(Number(book?.questionsCompleted) || 0));
    const chapterCount = getBookChapterList(book).length;
    const lastOpenedText = book?.lastOpened
      ? new Date(book.lastOpened).toLocaleDateString()
      : "Never";

    return (
      <button
        key={book.id}
        type="button"
        className="selectBookCard"
        onClick={onSelect}
      >
        <div className="selectBookCardTop">
          <h3>{book.name}</h3>
          <p className="selectBookLastOpened">Last opened: {lastOpenedText}</p>
        </div>
        <div className="selectBookStats">
          <div className="selectBookStat">
            <span>Words</span>
            <strong>{words.length}</strong>
          </div>
          <div className="selectBookStat">
            <span>Chapters</span>
            <strong>{chapterCount}</strong>
          </div>
          <div className="selectBookStat">
            <span>Questions Completed</span>
            <strong>{questionsCompleted}</strong>
          </div>
        </div>
      </button>
    );
  }

  function openBookFromSelect(bookId, nextScreen) {
    const openedAt = Date.now();
    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        book.id === bookId ? { ...book, lastOpened: openedAt } : book
      )
    );
    setCurrentBookId(bookId);
    setScreen(nextScreen);
  }

  function renderMyBookCard(book) {
    const words = book?.words || [];
    const questionsCompleted = Math.max(0, Math.floor(Number(book?.questionsCompleted) || 0));
    const chapterCount = getBookChapterList(book).length;
    const lastOpenedText = book?.lastOpened
      ? new Date(book.lastOpened).toLocaleDateString()
      : "Never";

    return (
      <div
        key={book.id}
        className="selectBookCard booksCard"
        role="button"
        tabIndex={0}
        onClick={() => {
          setCurrentBookId(book.id);
          setScreen("bookMenu");
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setCurrentBookId(book.id);
          setScreen("bookMenu");
        }}
      >
        <button
          className="deleteBtn bookDeleteBtn"
          aria-label={`Delete ${book.name}`}
          onClick={(e) => {
            e.stopPropagation();
            askDeleteBook(book);
          }}
        >
          x
        </button>
        <button
          type="button"
          className={`pinBtn ${book.pinned ? "isPinned" : ""}`}
          aria-label={book.pinned ? `Unpin ${book.name}` : `Pin ${book.name}`}
          onClick={(e) => {
            e.stopPropagation();
            togglePinBook(book.id);
          }}
        >
          <PinIcon pinned={book.pinned} />
        </button>
        <div className="selectBookCardTop">
          <h3>{book.name}</h3>
          <p className="selectBookLastOpened">Last opened: {lastOpenedText}</p>
        </div>
        <div className="selectBookStats">
          <div className="selectBookStat">
            <span>Words</span>
            <strong>{words.length}</strong>
          </div>
          <div className="selectBookStat">
            <span>Chapters</span>
            <strong>{chapterCount}</strong>
          </div>
          <div className="selectBookStat">
            <span>Questions Completed</span>
            <strong>{questionsCompleted}</strong>
          </div>
        </div>
      </div>
    );
  }

  function initializeQuizSetupSelection() {
    setQuizSetupSelection({
      bookIds: [],
      chapterKeys: [],
      difficultyKeys: [],
    });
  }

  function toggleQuizSetupBook(bookId) {
    const targetId = String(bookId);
    setQuizSetupSelection((prev) => {
      const hasBook = prev.bookIds.includes(targetId);
      const nextBookIds = hasBook
        ? prev.bookIds.filter((id) => id !== targetId)
        : [...prev.bookIds, targetId];

      const nextBooks = books.filter((book) => nextBookIds.includes(String(book.id)));
      const allowedChapterKeys = new Set(
        nextBooks.flatMap((book) =>
          getBookChapterList(book).map((chapter) => `${book.id}:${chapter.id}`)
        )
      );
      const nextChapterKeys = prev.chapterKeys.filter((key) => allowedChapterKeys.has(key));

      return {
        ...prev,
        bookIds: nextBookIds,
        chapterKeys: nextChapterKeys,
      };
    });
  }

  function toggleQuizSetupChapter(chapterKey) {
    setQuizSetupSelection((prev) => {
      const hasChapter = prev.chapterKeys.includes(chapterKey);
      return {
        ...prev,
        chapterKeys: hasChapter
          ? prev.chapterKeys.filter((key) => key !== chapterKey)
          : [...prev.chapterKeys, chapterKey],
      };
    });
  }

  function toggleQuizSetupDifficulty(difficultyKey) {
    setQuizSetupSelection((prev) => {
      const hasDifficulty = prev.difficultyKeys.includes(difficultyKey);
      return {
        ...prev,
        difficultyKeys: hasDifficulty
          ? prev.difficultyKeys.filter((key) => key !== difficultyKey)
          : [...prev.difficultyKeys, difficultyKey],
      };
    });
  }

  // Add / delete words
  async function addWord() {
    if (!inputWord.trim() || !currentBook) return;

    const cleanWord = inputWord.trim();
    const normalizedInput = cleanWord.toLowerCase();
    const duplicateWord = currentBook.words.some(
      (w) =>
        w.word.trim().toLowerCase() === normalizedInput &&
        (w.chapterId || fallbackChapterId) === safeSelectedChapterIdForNewWords
    );

    if (duplicateWord) {
      openNoticeModal("That word is already in this chapter.", "Duplicate Word");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`
      );

      if (!res.ok) {
        openNoticeModal("Please enter a valid English word.", "Invalid Word");
        return;
      }

      const data = await res.json();
      const definitions = extractDefinitions(data);
      const dictionaryExamples = extractExampleSentences(data);
      const supplementalExamples = await fetchSupplementalExamples(cleanWord);
      const normalizedExamples = rankAndSelectExamples(
        cleanWord,
        dictionaryExamples,
        supplementalExamples
      );
      const pronunciation = extractPronunciation(data);

      if (!definitions.length) {
        openNoticeModal(
          "A valid definition is required before this word can be added.",
          "Definition Required"
        );
        return;
      }

      const updatedBooks = books.map((book) =>
        book.id === currentBookId
          ? {
              ...book,
              words: [
                {
                  word: cleanWord,
                  pronunciation,
                  definitions,
                  examples: normalizedExamples,
                  masteryXp: 0,
                  currentDefinitionIndex: 0,
                  definition: definitions[0],
                  chapterId: safeSelectedChapterIdForNewWords,
                  difficulty: estimateCefrLevel(cleanWord),
                },
                ...book.words,
              ],
              lastOpened: Date.now(),
            }
          : book
      );

      setBooks(updatedBooks);
      setWeeklyStats((prev) => {
        const current = ensureCurrentWeekStats(prev);
        return {
          ...current,
          definitionsAdded: current.definitionsAdded + definitions.length,
          wordsAdded: current.wordsAdded + 1,
        };
      });
      setActivityHistory((prev) =>
        mergeActivityDelta(prev, {
          definitionsAdded: definitions.length,
          wordsAdded: 1,
          questionsCompleted: 0,
          timeSpentSeconds: 0,
        })
      );
      awardXp(getWordXpGain(streak.count));
      awardCoins(getWordCoinGain(streak.count) + wordCoinBonus);
      updateStreak();
      setInputWord("");
    } catch {
      openNoticeModal("Failed to fetch definition.", "Network Error");
    } finally {
      setLoading(false);
    }
  }

  function deleteWord(wordToDelete, wordIndexToDelete) {
    const updatedBooks = books.map((book) =>
      book.id === currentBookId
        ? {
            ...book,
            words: book.words.filter((w, index) => {
              if (index !== wordIndexToDelete) return true;
              return w.word !== wordToDelete;
            }),
          }
        : book
    );
    setBooks(updatedBooks);
  }

  function cycleWordDefinition(wordToUpdate, direction) {
    const updatedBooks = books.map((book) => {
      if (book.id !== currentBookId) return book;

      return {
        ...book,
        words: book.words.map((w) => {
          if (w.word !== wordToUpdate) return w;

          const definitions = getWordDefinitions(w);
          if (definitions.length <= 1) return w;

          const currentIndex = Math.min(
            Math.max(w.currentDefinitionIndex ?? 0, 0),
            definitions.length - 1
          );
          const nextIndex =
            (currentIndex + direction + definitions.length) % definitions.length;

          return {
            ...w,
            currentDefinitionIndex: nextIndex,
            definition: definitions[nextIndex],
          };
        }),
      };
    });

    setBooks(updatedBooks);
  }

  function getSafeDefinitionIndex(wordEntry) {
    const definitions = getWordDefinitions(wordEntry);
    if (!definitions.length) return 0;
    return Math.min(
      Math.max(wordEntry?.currentDefinitionIndex ?? 0, 0),
      definitions.length - 1
    );
  }

  function getDefinitionEditKey(wordEntry) {
    return `${currentBookId}:${wordEntry.word}:${getSafeDefinitionIndex(wordEntry)}`;
  }

  function startEditingDefinition(wordEntry) {
    setEditingDefinitionKey(getDefinitionEditKey(wordEntry));
    setEditingDefinitionDraft(getSelectedDefinition(wordEntry));
  }

  function cancelEditingDefinition() {
    setEditingDefinitionKey("");
    setEditingDefinitionDraft("");
  }

  function saveEditedDefinition(wordToUpdate) {
    const nextText = editingDefinitionDraft.trim();
    if (!nextText) return;

    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (book.id !== currentBookId) return book;

        return {
          ...book,
          words: book.words.map((w) => {
            if (w.word !== wordToUpdate) return w;

            const definitions = getWordDefinitions(w);
            if (!definitions.length) return w;

            const currentIndex = getSafeDefinitionIndex(w);
            const nextDefinitions = [...definitions];
            const originalDefinitions = Array.isArray(w.originalDefinitions)
              ? [...w.originalDefinitions]
              : [...definitions];

            nextDefinitions[currentIndex] = nextText;

            return {
              ...w,
              definitions: nextDefinitions,
              originalDefinitions,
              definition: nextDefinitions[currentIndex],
              currentDefinitionIndex: currentIndex,
            };
          }),
        };
      })
    );

    cancelEditingDefinition();
  }

  function canUndoDefinitionEdit(wordEntry) {
    const definitions = getWordDefinitions(wordEntry);
    if (!definitions.length) return false;
    const originalDefinitions = Array.isArray(wordEntry?.originalDefinitions)
      ? wordEntry.originalDefinitions
      : null;
    if (!originalDefinitions?.length) return false;

    const currentIndex = getSafeDefinitionIndex(wordEntry);
    const original = String(originalDefinitions[currentIndex] || "").trim();
    const current = String(definitions[currentIndex] || "").trim();
    return Boolean(original) && original !== current;
  }

  function isDefinitionEdited(wordEntry) {
    return canUndoDefinitionEdit(wordEntry);
  }

  function undoDefinitionEdit(wordToUpdate) {
    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (book.id !== currentBookId) return book;

        return {
          ...book,
          words: book.words.map((w) => {
            if (w.word !== wordToUpdate) return w;

            const definitions = getWordDefinitions(w);
            const originalDefinitions = Array.isArray(w.originalDefinitions)
              ? w.originalDefinitions
              : [];
            if (!definitions.length || !originalDefinitions.length) return w;

            const currentIndex = getSafeDefinitionIndex(w);
            const originalDefinition = String(originalDefinitions[currentIndex] || "").trim();
            if (!originalDefinition) return w;

            const nextDefinitions = [...definitions];
            nextDefinitions[currentIndex] = originalDefinition;

            return {
              ...w,
              definitions: nextDefinitions,
              definition: nextDefinitions[currentIndex],
              currentDefinitionIndex: currentIndex,
            };
          }),
        };
      })
    );

    cancelEditingDefinition();
  }

  function recordMistakeForWord(
    wordToUpdate,
    sourceBookId = currentBookId,
    sourceChapterId = DEFAULT_CHAPTER_ID
  ) {
    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (book.id !== sourceBookId) return book;

        return {
          ...book,
          words: book.words.map((wordEntry) =>
            wordEntry.word === wordToUpdate &&
            (wordEntry.chapterId || DEFAULT_CHAPTER_ID) === (sourceChapterId || DEFAULT_CHAPTER_ID)
              ? {
                  ...wordEntry,
                  mistakeCount: getMistakeCount(wordEntry) + 1,
                }
              : wordEntry
          ),
        };
      })
    );
  }

  function resolveMistakeForWord(
    wordToUpdate,
    sourceBookId = currentBookId,
    sourceChapterId = DEFAULT_CHAPTER_ID
  ) {
    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (book.id !== sourceBookId) return book;

        return {
          ...book,
          words: book.words.map((wordEntry) =>
            wordEntry.word === wordToUpdate &&
            (wordEntry.chapterId || DEFAULT_CHAPTER_ID) === (sourceChapterId || DEFAULT_CHAPTER_ID)
              ? {
                  ...wordEntry,
                  mistakeCount: Math.max(getMistakeCount(wordEntry) - 1, 0),
                  masteryXp: Math.min(getWordMasteryXp(wordEntry) + 1, WORD_MASTERY_MAX_XP),
                }
              : wordEntry
          ),
        };
      })
    );
  }

  function awardXp(amount) {
    if (!isLevelsEnabled) return;
    if (!amount || amount <= 0) return;
    const boostedAmount = Math.max(1, Math.round(amount * xpMultiplier));
    setXp((prevXp) => prevXp + boostedAmount);
  }

  function awardCoins(amount) {
    if (!isEconomyEnabled) return;
    if (!amount || amount <= 0) return;
    setCoins((prevCoins) => prevCoins + amount);
  }

  function recordQuizQuestionCompleted(sourceBookId = null) {
    setWeeklyStats((prev) => {
      const current = ensureCurrentWeekStats(prev);
      return {
        ...current,
        questionsCompleted: (current.questionsCompleted || 0) + 1,
      };
    });
    setActivityHistory((prev) =>
      mergeActivityDelta(prev, {
        definitionsAdded: 0,
        wordsAdded: 0,
        questionsCompleted: 1,
        timeSpentSeconds: 0,
      })
    );

    if (sourceBookId === null || sourceBookId === undefined) return;
    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        book.id === sourceBookId
          ? {
              ...book,
              questionsCompleted: Math.max(
                0,
                Math.floor(Number(book.questionsCompleted) || 0)
              ) + 1,
            }
          : book
      )
    );
  }

  function handleQuizComplete(summary) {
    const safeSummary = summary && typeof summary === "object" ? summary : {};
    if (safeSummary.isMistakeReview) return;
    const completedMode = normalizeQuizMode(safeSummary.mode, "normal");

    const mistakes = Array.isArray(safeSummary.mistakes) ? safeSummary.mistakes : [];
    const nextGlobalKeys = Array.from(
      new Set(
        mistakes
          .map((item) => getWordSessionKey(item?.sourceBookId, item?.chapterId, item?.word))
          .filter(Boolean)
      )
    );
    setLastQuizMistakeKeys(nextGlobalKeys);
    setLastQuizMistakeMode(completedMode);

    const groupedByBook = {};
    mistakes.forEach((item) => {
      const bookId = String(item?.sourceBookId ?? "");
      if (!bookId) return;
      const key = getWordSessionKey(item?.sourceBookId, item?.chapterId, item?.word);
      if (!key) return;
      if (!groupedByBook[bookId]) groupedByBook[bookId] = [];
      groupedByBook[bookId].push(key);
    });

    setLastQuizMistakeKeysByBook((prev) => {
      const next = { ...prev };
      const bookIdsInQuiz = new Set(
        Array.isArray(safeSummary.questionBookIds)
          ? safeSummary.questionBookIds.map((id) => String(id))
          : []
      );

      bookIdsInQuiz.forEach((bookId) => {
        next[bookId] = Array.from(new Set(groupedByBook[bookId] || []));
      });

      return next;
    });

    setLastQuizMistakeModeByBook((prev) => {
      const next = { ...prev };
      const bookIdsInQuiz = new Set(
        Array.isArray(safeSummary.questionBookIds)
          ? safeSummary.questionBookIds.map((id) => String(id))
          : []
      );
      bookIdsInQuiz.forEach((bookId) => {
        next[bookId] = completedMode;
      });
      return next;
    });
  }

  function purchaseUpgrade(upgradeId) {
    if (!isEconomyEnabled) return;
    if (!isLevelsEnabled && upgradeId === "xp_boost") return;
    const upgrade = MARKET_UPGRADES.find((item) => item.id === upgradeId);
    if (!upgrade) return;

    const currentLevel = marketLevels?.[upgradeId] ?? 0;
    if (currentLevel >= upgrade.maxLevel) return;

    const cost = getUpgradeCost(upgrade, currentLevel);
    if (coins < cost) {
      openNoticeModal("Not enough coins.", "Purchase Failed");
      return;
    }

    setCoins((prevCoins) => prevCoins - cost);
    setMarketLevels((prev) => ({
      ...prev,
      [upgradeId]: currentLevel + 1,
    }));
  }

  if (!isBetaUnlocked) {
    return <BetaGate onUnlock={setIsBetaUnlocked} />;
  }

  // ---------- DASHBOARD ----------
  if (screen === "dashboard") {
    return renderWithSidebar(
      <div className="page dashboardPage">
        <div className="dashboardHeader">
          <div className="dashboardTitleRow">
            <h1>Vocabulary</h1>
          </div>
          <div className={`dashboardStatus ${isEconomyEnabled ? "" : "isEconomyOff"}`.trim()}>
            <div className="streakBadge">🔥 {streak.count} day{streak.count !== 1 && "s"}</div>
            {isEconomyEnabled && (
              <div className="coinInfoWrap" ref={coinInfoRef}>
              <button
                type="button"
                className="coinInfoTrigger"
                onClick={() => setIsCoinInfoOpen((prev) => !prev)}
                aria-expanded={isCoinInfoOpen}
                aria-label="Toggle coin information"
              >
                🪙 {coins}
              </button>
              {isCoinInfoOpen && (
                <div className="coinInfoCard">
                  <p>New word: +{currentWordCoinGain} coins</p>
                  {isLevelsEnabled && <p>XP multiplier: x{xpMultiplier.toFixed(1)}</p>}
                  <p>Quiz coins are awarded only when you finish.</p>
                  <p>Minimum {MIN_QUIZ_QUESTIONS_FOR_COINS} questions needed for quiz coin rewards.</p>
                  <p>Longer quizzes reward more coins (full rewards at {FULL_COIN_REWARD_QUIZ_LENGTH}+ questions).</p>
                  <p>Completion bonus: 100%=+8, 80%+=+5, 60%+=+3, below 60%=+2.</p>
                </div>
              )}
              </div>
            )}
            {isLevelsEnabled && (
            <div className="xpCard" ref={levelInfoRef}>
              <button
                type="button"
                className="xpInfoTrigger"
                onClick={() => setIsLevelInfoOpen((prev) => !prev)}
                aria-expanded={isLevelInfoOpen}
                aria-label="Toggle level information"
              >
                <div className="xpTopRow">
                  <div className="levelStar" aria-label={`Level ${level}`}>
                    <svg
                      className="levelStarIcon"
                      viewBox="0 0 100 100"
                      aria-hidden="true"
                      focusable="false" preserveAspectRatio="xMidYMid meet"
                    >
                      <path
                        d="M50 12c4 0 7 2 8 5l5 14c1 3 4 5 8 5l14 1c7 0 10 8 5 12l-11 9c-3 2-4 6-3 9l4 14c2 6-5 11-11 7l-12-8c-3-2-7-2-10 0l-12 8c-6 4-13-1-11-7l4-14c1-3 0-7-3-9l-11-9c-5-4-2-12 5-12l14-1c4 0 7-2 8-5l5-14c1-3 4-5 8-5z"
                        className="levelStarShape"
                      />
                      <text
                        x="52"
                        y="50"
                        textAnchor="middle"
                        dy="0.39em"
                        className="levelStarValue"
                      >
                        {level}
                      </text>
                    </svg>
                  </div>
                  <div className="xpBarGroup">
                    <div
                      className="xpBarTrack"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={xpToNextLevel}
                      aria-valuenow={xpProgress}
                    >
                      <div
                        className="xpBarFill"
                        style={{ width: `${(xpProgress / xpToNextLevel) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
              {isLevelInfoOpen && (
                <div className="levelInfoCard">
                  <div className="levelInfoGrid">
                    <div className="levelInfoStat">
                      <span>Total XP</span>
                      <strong>{xp}</strong>
                    </div>
                    <div className="levelInfoStat">
                      <span>Current Level</span>
                      <strong>{level}</strong>
                    </div>
                    <div className="levelInfoStat">
                      <span>To Next Level</span>
                      <strong>{xpRemainingToNextLevel} XP</strong>
                    </div>
                    <div className="levelInfoStat">
                      <span>XP Per New Word</span>
                      <strong>{currentWordXpGain} XP</strong>
                    </div>
                    {isEconomyEnabled && (
                      <div className="levelInfoStat">
                        <span>Coin Per New Word</span>
                        <strong>{currentWordCoinGain} coins</strong>
                      </div>
                    )}
                    {isEconomyEnabled && (
                      <div className="levelInfoStat">
                        <span>XP Multiplier</span>
                        <strong>x{xpMultiplier.toFixed(1)}</strong>
                      </div>
                    )}
                    {isEconomyEnabled && (
                      <div className="levelInfoStat">
                        <span>Coins</span>
                        <strong>{coins}</strong>
                      </div>
                    )}
                  </div>
                  <div className="levelInfoUpcoming">
                    <p>Upcoming Levels</p>
                    {upcomingLevels.map((item) => (
                      <div key={item.level} className="levelInfoRow">
                        <span>Level {item.level}</span>
                        <span>{item.requiredXp} XP required</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        <div className="weeklyOverviewSection">
          <h2 className="weeklyOverviewTitle">Weekly Overview</h2>
          <div className="weeklyOverviewGrid">
            <div className="weeklyOverviewCard">
              <p className="weeklyOverviewLabel">Questions Completed</p>
              <strong className="weeklyOverviewValue">{currentWeekStats.questionsCompleted || 0}</strong>
            </div>
            <div className="weeklyOverviewCard">
              <p className="weeklyOverviewLabel">Time Spent</p>
              <strong className="weeklyOverviewValue">{weeklyTimeSpent}</strong>
            </div>
            <div className="weeklyOverviewCard">
              <p className="weeklyOverviewLabel">Words Added</p>
              <strong className="weeklyOverviewValue">{currentWeekStats.wordsAdded}</strong>
            </div>
          </div>
        </div>

        <div className="recentSection">
          <h2 className="recentTitle">Quick Access</h2>
          <div className="recentBar">
          <div className="recentScroll">
            <button className="recentSquare addSquare" onClick={openAddBookModal}>
              +
            </button>

            {quickAccessBooks.map((book) => (
                <div key={book.id} className="recentSquareWrap">
                  <button
                    type="button"
                    className={`pinBtn small ${book.pinned ? "isPinned" : ""}`}
                    aria-label={book.pinned ? `Unpin ${book.name}` : `Pin ${book.name}`}
                    onClick={() => togglePinBook(book.id)}
                  >
                    <PinIcon pinned={book.pinned} />
                  </button>
                  <button
                    className="recentSquare"
                    onClick={() => {
                      setCurrentBookId(book.id);
                      setScreen("bookMenu");
                    }}
                  >
                  {book.name}
                  </button>
                </div>
              ))}
          </div>
        </div>
        </div>
        <div className="panelGrid dashboardPanelGrid">
          <div
            className="panelCard wide"
            role="button"
            tabIndex={0}
            onClick={() => setScreen("definitionsSelect")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("definitionsSelect");
              }
            }}
          >
            <span>{"\uD83E\uDDE0"} Definitions</span>
          </div>
          <div
            className="panelCard wide"
            role="button"
            tabIndex={0}
            onClick={() => setScreen("flashcardsSelect")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("flashcardsSelect");
              }
            }}
          >
            <span>{"\u26A1"} Flashcards</span>
          </div>
          <div
            className="panelCard wide"
            role="button"
            tabIndex={0}
            onClick={() => {
      setQuizBackScreen("quizSelect");
              setQuizMode("normal");
              initializeQuizSetupSelection();
              setScreen("quizSelect");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setQuizBackScreen("quizSelect");
                setQuizMode("normal");
                initializeQuizSetupSelection();
                setScreen("quizSelect");
              }
            }}
          >
            <span>{"\u2705"} Quiz</span>
          </div>
          <div
            className="panelCard wide"
            role="button"
            tabIndex={0}
            onClick={() => setScreen("books")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("books");
              }
            }}
          >
            <span>{"\uD83D\uDCDA"} My Books</span>
          </div>
          {isEconomyEnabled && (
            <div
              className="panelCard wide"
              role="button"
              tabIndex={0}
              onClick={() => setScreen("market")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setScreen("market");
                }
              }}
            >
              <span>{"\uD83D\uDED2"} Market</span>
            </div>
          )}
          <div
            className="panelCard wide"
            role="button"
            tabIndex={0}
            onClick={() => setScreen("data")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("data");
              }
            }}
          >
            <span>{"\uD83D\uDCCA"} Data</span>
          </div>
          <div
            className="panelCard wide"
            role="button"
            tabIndex={0}
            onClick={() => {
              setQuizBackScreen("dashboard");
              requestMistakeReview("global");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setQuizBackScreen("dashboard");
                requestMistakeReview("global");
              }
            }}
          >
            <span>{"\uD83D\uDD01"} Mistake Review</span>
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- SETTINGS ----------
  if (screen === "settings") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>Settings</h1>
        </div>
        <div className="analyticsSection">
          <div className="analyticsGrid">
            <div className="analyticsCard settingsCard">
              <h3>Appearance</h3>
              <div className="settingsRow">
                <span>Theme</span>
                <button
                  type="button"
                  className={`themeSwitch ${theme === "dark" ? "isDark" : ""}`}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                  <span className="themeSwitchIcon" aria-hidden="true">
                    {theme === "dark" ? "\uD83C\uDF19" : "\u2600"}
                  </span>
                </button>
              </div>
            </div>
            <div className="analyticsCard settingsCard">
              <h3>Features</h3>
              <div className="settingsRow">
                <span>Levels + XP</span>
                <button
                  type="button"
                  className={`themeSwitch ${isLevelsEnabled ? "isDark" : ""}`}
                  onClick={() => setIsLevelsEnabled((prev) => !prev)}
                  aria-label={`${isLevelsEnabled ? "Disable" : "Enable"} level and xp features`}
                  style={isLevelsEnabled ? { backgroundColor: "#1d4f8f", borderColor: "#1d4f8f" } : undefined}
                >
                  <span className="themeSwitchIcon" aria-hidden="true" />
                </button>
              </div>
              <div className="settingsRow">
                <span>Economy (Coins + Market)</span>
                <button
                  type="button"
                  className={`themeSwitch ${isEconomyEnabled ? "isDark" : ""}`}
                  onClick={() => setIsEconomyEnabled((prev) => !prev)}
                  aria-label={`${isEconomyEnabled ? "Disable" : "Enable"} economy features`}
                  style={isEconomyEnabled ? { backgroundColor: "#1d4f8f", borderColor: "#1d4f8f" } : undefined}
                >
                  <span className="themeSwitchIcon" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- ACCOUNT ----------
  if (screen === "account") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>My Account</h1>
        </div>
        <div className="analyticsSection">
          <div className="analyticsGrid">
            <div className="analyticsCard settingsCard">
              <h3>Account</h3>
              {authToken ? (
                <>
                  <p className="settingsHint">Signed in as <strong>{authUsername}</strong></p>
                  <div className="settingsRow">
                    <span>Session</span>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={logoutAccount}
                    >
                      Log Out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="settingsHint">Create an account or sign in to sync with backend.</p>
                  <div className="settingsAuthModeRow" role="group" aria-label="Choose account action">
                    <button
                      type="button"
                      className={`settingsAuthModeBtn ${authMode === "login" ? "isActive" : ""}`}
                      onClick={() => setAuthMode("login")}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={`settingsAuthModeBtn ${authMode === "register" ? "isActive" : ""}`}
                      onClick={() => setAuthMode("register")}
                    >
                      Register
                    </button>
                  </div>
                  <input
                    className="settingsInput"
                    value={authForm.username}
                    onChange={(event) => {
                      setAuthForm((prev) => ({ ...prev, username: event.target.value }));
                      if (authError) setAuthError("");
                    }}
                    placeholder="username (a-z, 0-9, _)"
                    autoComplete="username"
                  />
                  <div className="settingsPasswordWrap">
                    <input
                      className="settingsInput settingsPasswordInput"
                      type={isPasswordVisible ? "text" : "password"}
                      value={authForm.password}
                      onChange={(event) => {
                        setAuthForm((prev) => ({ ...prev, password: event.target.value }));
                        if (authError) setAuthError("");
                      }}
                      placeholder="password (min 8 chars)"
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      className="settingsPasswordToggleBtn"
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                      title={isPasswordVisible ? "Hide password" : "Show password"}
                    >
                      {"\uD83D\uDC41"}
                    </button>
                  </div>
                  {authMode === "register" ? (
                    <div className="settingsPasswordWrap">
                      <input
                        className="settingsInput settingsPasswordInput"
                        type={isPasswordVisible ? "text" : "password"}
                        value={authForm.confirmPassword}
                        onChange={(event) => {
                          setAuthForm((prev) => ({ ...prev, confirmPassword: event.target.value }));
                          if (authError) setAuthError("");
                        }}
                        placeholder="confirm password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="settingsPasswordToggleBtn"
                        onClick={() => setIsPasswordVisible((prev) => !prev)}
                        aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                        title={isPasswordVisible ? "Hide password" : "Show password"}
                      >
                        {"\uD83D\uDC41"}
                      </button>
                    </div>
                  ) : null}
                  <div className="settingsRow">
                    <span>{authMode === "login" ? "Use existing account" : "Create new account"}</span>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={() => submitAuth(authMode)}
                      disabled={isAuthSubmitting}
                    >
                      {isAuthSubmitting
                        ? "Please wait..."
                        : authMode === "login"
                          ? "Log In"
                          : "Register"}
                    </button>
                  </div>
                  {authError ? <p className="settingsErrorText">{authError}</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- DATA ----------
  if (screen === "data") {
    const overviewCards = [
      { key: "daily", title: "Daily", stats: activityDailyStats },
      { key: "weekly", title: "Weekly", stats: activityWeeklyStats },
      { key: "monthly", title: "Monthly", stats: activityMonthlyStats },
      { key: "total", title: "Total", stats: activityTotalStats },
    ];
    const chartTickFractions = [1, 0.75, 0.5, 0.25, 0];
    const trendTicks = chartTickFractions.map((fraction, index) =>
      index === chartTickFractions.length - 1 ? 0 : Math.round(maxTrendValue * fraction)
    );
    const questionTrendTicks = chartTickFractions.map((fraction, index) =>
      index === chartTickFractions.length - 1 ? 0 : Math.round(maxQuestionTrendValue * fraction)
    );
    const difficultyTicks = chartTickFractions.map((fraction, index) =>
      index === chartTickFractions.length - 1 ? 0 : Math.round(maxDifficultyWordCount * fraction)
    );
    const masteryTicks = chartTickFractions.map((fraction, index) =>
      index === chartTickFractions.length - 1 ? 0 : Math.round(maxMasteryWordCount * fraction)
    );

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>Data</h1>
        </div>

        <div className="analyticsSection">
          <div className="activityOverviewGrid">
            {overviewCards.map((card) => (
              <div key={card.key} className="activityOverviewCard">
                <h3>{card.title}</h3>
                <div className="activityOverviewStats">
                  <div className="activityOverviewStat">
                    <span>Questions</span>
                    <strong>{card.stats.questionsCompleted || 0}</strong>
                  </div>
                  <div className="activityOverviewStat">
                    <span>Words</span>
                    <strong>{card.stats.wordsAdded}</strong>
                  </div>
                  <div className="activityOverviewStat">
                    <span>Time</span>
                    <strong>{formatWeeklyTime(card.stats.timeSpentSeconds)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="analyticsGrid">
            <div className="analyticsCard">
              <h3>Words Added Over Time (Last 14 Days)</h3>
              <div className="chartGridLayout">
                <div className="chartYAxis" aria-hidden="true">
                  {trendTicks.map((tick, index) => (
                    <span key={`trend-tick-${index}`}>{tick}</span>
                  ))}
                </div>
                <div className="chartPlot">
                  <div className="chartGridLines" aria-hidden="true">
                    {chartTickFractions.map((fraction, index) => (
                      <span key={`trend-line-${index}`} style={{ bottom: `${fraction * 100}%` }} />
                    ))}
                  </div>
                  <div className="trendBars" role="img" aria-label="Words added over last 14 days">
                    {wordTrend.map((item) => {
                      const heightPercent = Math.round((item.value / maxTrendValue) * 100);
                      return (
                        <div className="trendBarCol" key={item.key}>
                          <div
                            className="trendBar"
                            style={{ height: `${Math.max(heightPercent, item.value > 0 ? 6 : 0)}%` }}
                            title={`${item.key}: ${item.value} words`}
                          />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="analyticsCard">
              <h3>Questions Completed Over Time (Last 14 Days)</h3>
              <div className="chartGridLayout">
                <div className="chartYAxis" aria-hidden="true">
                  {questionTrendTicks.map((tick, index) => (
                    <span key={`question-trend-tick-${index}`}>{tick}</span>
                  ))}
                </div>
                <div className="chartPlot">
                  <div className="chartGridLines" aria-hidden="true">
                    {chartTickFractions.map((fraction, index) => (
                      <span key={`question-trend-line-${index}`} style={{ bottom: `${fraction * 100}%` }} />
                    ))}
                  </div>
                  <div className="trendBars" role="img" aria-label="Questions completed over last 14 days">
                    {questionTrend.map((item) => {
                      const heightPercent = Math.round((item.value / maxQuestionTrendValue) * 100);
                      return (
                        <div className="trendBarCol" key={item.key}>
                          <div
                            className="trendBar isQuestions"
                            style={{ height: `${Math.max(heightPercent, item.value > 0 ? 6 : 0)}%` }}
                            title={`${item.key}: ${item.value} questions`}
                          />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="analyticsCard">
              <h3>Words by CEFR Level</h3>
              <div className="chartGridLayout">
                <div className="chartYAxis" aria-hidden="true">
                  {difficultyTicks.map((tick, index) => (
                    <span key={`difficulty-tick-${index}`}>{tick}</span>
                  ))}
                </div>
                <div className="chartPlot">
                  <div className="chartGridLines" aria-hidden="true">
                    {chartTickFractions.map((fraction, index) => (
                      <span key={`difficulty-line-${index}`} style={{ bottom: `${fraction * 100}%` }} />
                    ))}
                  </div>
                  <div className="difficultyChart" role="img" aria-label="Word count by CEFR level">
                    {difficultyWordCounts.map((item) => {
                      const heightPercent = Math.round((item.count / maxDifficultyWordCount) * 100);
                      return (
                        <div className="difficultyChartCol" key={item.value}>
                          <strong>{item.label}</strong>
                          <div
                            className="difficultyChartBar"
                            style={{ height: `${Math.max(heightPercent, item.count > 0 ? 6 : 0)}%` }}
                            title={`${item.label}: ${item.count} words`}
                          />
                          <span>{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="analyticsCard">
              <h3>Words by Mastery Level</h3>
              <div className="chartGridLayout">
                <div className="chartYAxis" aria-hidden="true">
                  {masteryTicks.map((tick, index) => (
                    <span key={`mastery-tick-${index}`}>{tick}</span>
                  ))}
                </div>
                <div className="chartPlot">
                  <div className="chartGridLines" aria-hidden="true">
                    {chartTickFractions.map((fraction, index) => (
                      <span key={`mastery-line-${index}`} style={{ bottom: `${fraction * 100}%` }} />
                    ))}
                  </div>
                  <div className="difficultyChart masteryChart" role="img" aria-label="Word count by mastery level">
                    {masteryLevelCounts.map((item) => {
                      const heightPercent = Math.round((item.count / maxMasteryWordCount) * 100);
                      return (
                        <div className="difficultyChartCol" key={item.level}>
                          <strong>L{item.level}</strong>
                          <div
                            className="difficultyChartBar isMastery"
                            style={{ height: `${Math.max(heightPercent, item.count > 0 ? 6 : 0)}%` }}
                            title={`Level ${item.level} (${item.label}): ${item.count} words`}
                          />
                          <span>{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="analyticsCard backupRestoreCard">
            <h3>Backup & Restore</h3>
            <p className="quizSetupHint">
              Export your full app data to JSON, or import a previous backup file.
            </p>
            <div className="quizResultActions">
              <button type="button" className="primaryBtn" onClick={exportBackup}>
                Export Backup
              </button>
              <button
                type="button"
                className="primaryBtn"
                onClick={() => backupFileInputRef.current?.click()}
              >
                Import Backup
              </button>
              <input
                ref={backupFileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={importBackup}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- MARKET ----------
  if (screen === "market") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>Market</h1>
        </div>
        <div className="marketCoinLine">Coins: {coins}</div>
        <div className="marketGrid">
          {MARKET_UPGRADES.filter((upgrade) => isLevelsEnabled || upgrade.id !== "xp_boost").map((upgrade) => {
            const level = marketLevels?.[upgrade.id] ?? 0;
            const isMaxed = level >= upgrade.maxLevel;
            const cost = getUpgradeCost(upgrade, level);

            return (
              <div key={upgrade.id} className="marketCard">
                <h3>{upgrade.name}</h3>
                <p>{upgrade.description}</p>
                <div className="marketMeta">
                  <span>Level {level}/{upgrade.maxLevel}</span>
                  <span>{isMaxed ? "Maxed" : `Cost: ${cost} coins`}</span>
                </div>
                <button
                  type="button"
                  className="primaryBtn"
                  disabled={isMaxed || coins < cost}
                  onClick={() => purchaseUpgrade(upgrade.id)}
                >
                  {isMaxed ? "Purchased" : "Buy Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- BOOKS ----------
  if (screen === "books") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>My Books</h1>
        </div>
        <button className="primaryBtn" onClick={openAddBookModal}>+ Add Book</button>
        <div className="bookGrid selectBookGrid">
          {sortedBooksByRecent.map((book) => renderMyBookCard(book))}
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- BOOK MENU ----------
  if (screen === "bookMenu") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{currentBook?.name}</h1>
        </div>
        <div className="panelGrid">
          <div
            className="panelCard"
            role="button"
            tabIndex={0}
            onClick={() => setScreen("definitions")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("definitions");
              }
            }}
          >
            <span>{"\uD83E\uDDE0"} Definitions</span>
          </div>

          <div
            className="panelCard"
            role="button"
            tabIndex={0}
            onClick={() => setScreen("flashcards")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("flashcards");
              }
            }}
          >
            <span>{"\u26A1"} Flashcards</span>
          </div>
          <div
            className="panelCard"
            role="button"
            tabIndex={0}
            onClick={() => {
              setQuizBackScreen("bookMenu");
              setQuizMode("normal");
              initializeQuizSetupSelection();
              setScreen("quizSelect");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setQuizBackScreen("bookMenu");
                setQuizMode("normal");
                initializeQuizSetupSelection();
                setScreen("quizSelect");
              }
            }}
          >
            <span>{"\u2705"} Quiz</span>
          </div>
          <div
            className="panelCard"
            role="button"
            tabIndex={0}
            onClick={() => {
              setQuizBackScreen("bookMenu");
              requestMistakeReview("book");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setQuizBackScreen("bookMenu");
                requestMistakeReview("book");
              }
            }}
          >
            <span>{"\uD83D\uDD01"} Mistake Review</span>
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- DEFINITIONS SELECT ----------
  if (screen === "definitionsSelect") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>Select a Book</h1>
        </div>
        <div className="bookGrid selectBookGrid">
          {sortedBooksByRecent.map((book) =>
            renderSelectBookCard(book, () => {
              openBookFromSelect(book.id, "definitions");
            })
          )}
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- DEFINITIONS ----------
  if (screen === "definitions") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("bookMenu")}>&times;</button>
          <h1>{currentBook?.name}</h1>
        </div>
        <div className="inputRow">
          <input
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder="Add word..."
          />
          <button onClick={addWord}>+</button>
        </div>
        <div className="chapterControlsRow">
          <div className="chapterControlField">
            <span>Chapter for New Words</span>
            <InAppDropdown
              value={safeSelectedChapterIdForNewWords}
              options={currentBookChapters.map((chapter) => ({
                value: chapter.id,
                label: chapter.name,
              }))}
              onChange={(nextChapterId) => setSelectedChapterIdForNewWords(nextChapterId)}
            />
          </div>
          <button
            type="button"
            className="primaryBtn"
            onClick={() => setScreen("chapters")}
          >
            Manage Chapters
          </button>
        </div>
        {loading && <div className="spinner"></div>}
        <div className="wordList">
          {currentBook?.words.map((w, i) => {
            const wordExamples = getWordExamples(w);
            const exampleKey = `${currentBookId}:${w.chapterId || fallbackChapterId}:${w.word}:${i}`;
            const isExamplesExpanded = expandedExamplesKey === exampleKey;
            const definitionVariants = getWordDefinitions(w);
            const masteryMeta = getWordMasteryMeta(w);
            const totalDefinitionVariants = definitionVariants.length;
            const currentDefinitionVariant = Math.min(
              Math.max((w.currentDefinitionIndex ?? 0) + 1, 1),
              Math.max(totalDefinitionVariants, 1)
            );

            return (
              <div key={i} className="wordRow">
                <button className="deleteBtn" onClick={() => deleteWord(w.word, i)}>x</button>
                <div className="wordContent">
                  <div className="wordHeaderLine">
                    <div className="wordTitleGroup">
                      <strong>{w.word}</strong>
                      {(w.pronunciation || w.pronounciation) && (
                        <span className="wordPronunciation">{w.pronunciation || w.pronounciation}</span>
                      )}
                      <InAppDropdown
                        value={
                          currentBookChapters.some((chapter) => chapter.id === w.chapterId)
                            ? w.chapterId
                            : fallbackChapterId
                        }
                        options={currentBookChapters.map((chapter) => ({
                          value: chapter.id,
                          label: chapter.name,
                        }))}
                        onChange={(nextChapterId) => updateWordChapter(w.word, nextChapterId)}
                        className="wordChapterBadgeDropdown"
                        triggerClassName="asBadge"
                        menuClassName="isCompact"
                      />
                      <button
                        type="button"
                        className="wordChapterBadge wordDifficultyBadgeBtn"
                        aria-expanded={difficultyInfoWord === w.word}
                        aria-controls={`difficulty-info-${w.word}`}
                        onClick={() =>
                          setDifficultyInfoWord((prevWord) => (prevWord === w.word ? "" : w.word))
                        }
                      >
                        {getDifficultyLabel(w.difficulty)}
                      </button>
                      {isDefinitionEdited(w) && <span className="definitionEditedBadge">Edited</span>}
                    </div>
                    <div className="wordMasteryRow">
                      <span className="wordMasteryLevel">
                        Level {masteryMeta.level} - {masteryMeta.label}
                      </span>
                      <span className="wordMasteryBlocks" aria-hidden="true">
                        {getWordMasteryBlocks(w)}
                      </span>
                    </div>
                  </div>
                  {difficultyInfoWord === w.word && (
                    <div className="difficultyInfoPanel" id={`difficulty-info-${w.word}`}>
                      <strong>{getDifficultyLabel(w.difficulty)}</strong>
                      <p>
                        CEFR is the Common European Framework of Reference for languages.
                        <br />
                        {getDifficultyExplanation(w.difficulty)}
                      </p>
                    </div>
                  )}
                  <div className="definitionRow">
                    {editingDefinitionKey === getDefinitionEditKey(w) ? (
                      <textarea
                        className="definitionEditField"
                        value={editingDefinitionDraft}
                        onChange={(e) => setEditingDefinitionDraft(e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <p>{getSelectedDefinition(w)}</p>
                    )}
                    <div className="definitionControls">
                      {editingDefinitionKey === getDefinitionEditKey(w) ? (
                        <>
                          <button
                            type="button"
                            className="definitionActionBtn"
                            aria-label={`Undo definition edit for ${w.word}`}
                            title="Undo"
                            onClick={() => undoDefinitionEdit(w.word)}
                            disabled={!canUndoDefinitionEdit(w)}
                          >
                            {"\u21BA"}
                          </button>
                          <button
                            type="button"
                            className="definitionActionBtn isPrimary"
                            aria-label={`Save definition edit for ${w.word}`}
                            title="Save"
                            onClick={() => saveEditedDefinition(w.word)}
                            disabled={!editingDefinitionDraft.trim()}
                          >
                            {"\u2713"}
                          </button>
                          <button
                            type="button"
                            className="definitionActionBtn"
                            aria-label={`Cancel definition edit for ${w.word}`}
                            title="Cancel"
                            onClick={cancelEditingDefinition}
                          >
                            {"\u2715"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="definitionActionBtn definitionIconBtn"
                          aria-label={`Edit definition for ${w.word}`}
                          title="Edit"
                          onClick={() => startEditingDefinition(w)}
                        >
                          {"\u270E"}
                        </button>
                      )}
                      {totalDefinitionVariants > 1 && (
                        <div className="definitionVariantNav">
                          <span className="definitionVariantCount">
                            {currentDefinitionVariant} / {totalDefinitionVariants}
                          </span>
                          <div className="definitionVariantArrows">
                            <button
                              type="button"
                              className="definitionArrowBtn"
                              aria-label={`Show previous definition for ${w.word}`}
                              onClick={() => cycleWordDefinition(w.word, -1)}
                            >
                              {"<"}
                            </button>
                            <button
                              type="button"
                              className="definitionArrowBtn"
                              aria-label={`Show next definition for ${w.word}`}
                              onClick={() => cycleWordDefinition(w.word, 1)}
                            >
                              {">"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {wordExamples.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="exampleToggleBtn"
                        onClick={() =>
                          setExpandedExamplesKey((prev) => (prev === exampleKey ? "" : exampleKey))
                        }
                        aria-expanded={isExamplesExpanded}
                      >
                        {isExamplesExpanded ? "\u25B4 examples" : "\u25BE examples"}
                      </button>
                      <div className={`exampleListWrap ${isExamplesExpanded ? "isExpanded" : ""}`}>
                        <div className="exampleList">
                          {wordExamples.map((exampleText, exampleIndex) => (
                            <p key={`${exampleKey}-example-${exampleIndex}`} className="exampleItem">
                              {exampleText}
                            </p>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- CHAPTER MANAGEMENT ----------
  if (screen === "chapters") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("definitions")}>&times;</button>
          <h1>{currentBook?.name ? `${currentBook.name} Chapters` : "Chapter Management"}</h1>
        </div>
        {!currentBook ? (
          <p>Select a book first.</p>
        ) : (
          <>
            <div className="chapterCreateRow">
              <input
                value={newChapterName}
                onChange={(event) => setNewChapterName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addChapter()}
                placeholder="Create chapter..."
              />
              <button
                type="button"
                className="primaryBtn"
                onClick={addChapter}
                disabled={!newChapterName.trim()}
              >
                Add Chapter
              </button>
            </div>
            <div className="chapterList">
              {currentBookChapters.map((chapter) => {
                const wordCount = (currentBook?.words || []).filter(
                  (wordEntry) => (wordEntry.chapterId || fallbackChapterId) === chapter.id
                ).length;

                return (
                  <div key={chapter.id} className="chapterItem">
                    <div>
                      <strong>{chapter.name}</strong>
                      <p>
                        {wordCount} word{wordCount !== 1 && "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={() => askDeleteChapter(chapter)}
                      disabled={currentBookChapters.length <= 1}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {renderModal()}
      </div>
    );
  }

  // ---------- FLASHCARDS SELECT ----------
  if (screen === "flashcardsSelect") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>Select a Book</h1>
        </div>
        <div className="bookGrid selectBookGrid">
          {sortedBooksByRecent.map((book) =>
            renderSelectBookCard(book, () => {
              openBookFromSelect(book.id, "flashcards");
            })
          )}
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- QUIZ SELECT ----------
  if (screen === "quizSelect") {
    const allDifficultyKeys = ["unassigned", ...WORD_DIFFICULTY_OPTIONS.map((option) => option.value)];
    const selectedBookIdsSet = new Set(quizSetupSelection.bookIds);
    const selectedChapterKeysSet = new Set(quizSetupSelection.chapterKeys);
    const selectedDifficultyKeysSet = new Set(quizSetupSelection.difficultyKeys);
    const selectedBookCount = quizSetupSelection.bookIds.length;
    const selectedChapterCount = quizSetupSelection.chapterKeys.length;
    const selectedDifficultyCount = quizSetupSelection.difficultyKeys.length;
    const quizSetupChapterGroups = quizSetupBooks.map((book) => ({
      bookId: String(book.id),
      bookName: book.name,
      chapters: getBookChapterList(book).map((chapter) => ({
        key: `${book.id}:${chapter.id}`,
        label: chapter.name,
      })),
    }));
    const chapterOptionKeys = quizSetupChapterGroups.flatMap((group) =>
      group.chapters.map((chapter) => chapter.key)
    );
    const hasPreviousQuizMistakes = lastQuizMistakeKeys.length > 0;
    const canStartQuiz =
      quizSetupSelection.bookIds.length > 0 &&
      quizSetupSelection.chapterKeys.length > 0 &&
      quizSetupSelection.difficultyKeys.length > 0 &&
      quizSetupWords.length >= 2;

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button
            className="backBtn"
            aria-label="Go back"
            onClick={() => setScreen(quizBackScreen === "quizSelect" ? "dashboard" : quizBackScreen)}
          >
            &times;
          </button>
          <h1>Quiz Setup</h1>
        </div>
        <p className="quizSetupIntro">
          Choose what to include, then start your quiz.
        </p>
        {quizMode !== "mistake" && (
          <div className="chapterControlField quizChapterField">
            <div className="quizSetupFieldHeader">
              <span>1. Quiz Type</span>
            </div>
            <div className="quizChapterPills" role="group" aria-label="Select quiz type">
              <button
                type="button"
                className={`flashWordListItem ${quizMode === "normal" ? "isActive" : ""}`}
                onClick={() => setQuizMode("normal")}
              >
                Multiple-choice
              </button>
              <button
                type="button"
                className={`flashWordListItem ${quizMode === "typing" ? "isActive" : ""}`}
                onClick={() => setQuizMode("typing")}
              >
                Typing
              </button>
              <button
                type="button"
                className={`flashWordListItem ${quizMode === "blank" ? "isActive" : ""}`}
                onClick={() => setQuizMode("blank")}
              >
                Fill in the Blank
              </button>
            </div>
          </div>
        )}
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{quizMode !== "mistake" ? "2. Books" : "1. Books"}</span>
            <div className="quizSetupQuickActions">
              <button
                type="button"
                className="quizSetupActionBtn"
                onClick={() =>
                  setQuizSetupSelection((prev) => ({
                    ...prev,
                    bookIds: books.map((book) => String(book.id)),
                  }))
                }
                disabled={books.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="quizSetupActionBtn"
                onClick={() =>
                  setQuizSetupSelection((prev) => ({
                    ...prev,
                    bookIds: [],
                    chapterKeys: [],
                  }))
                }
                disabled={selectedBookCount === 0}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="quizChapterPills" role="group" aria-label="Select books">
            {sortedBooksByRecent.map((book) => (
              <button
                key={book.id}
                type="button"
                className={`flashWordListItem ${selectedBookIdsSet.has(String(book.id)) ? "isActive" : ""}`}
                onClick={() => toggleQuizSetupBook(book.id)}
              >
                {book.name}
              </button>
            ))}
          </div>
          {books.length === 0 && <p className="quizSetupHint">No books available yet.</p>}
          {selectedBookCount === 0 && (
            <p className="quizSetupHint">Select at least one book to see chapters.</p>
          )}
        </div>
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{quizMode !== "mistake" ? "3. Chapters" : "2. Chapters"}</span>
            <div className="quizSetupQuickActions">
              <button
                type="button"
                className="quizSetupActionBtn"
                onClick={() =>
                  setQuizSetupSelection((prev) => ({
                    ...prev,
                    chapterKeys: chapterOptionKeys,
                  }))
                }
                disabled={selectedBookCount === 0 || chapterOptionKeys.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="quizSetupActionBtn"
                onClick={() =>
                  setQuizSetupSelection((prev) => ({
                    ...prev,
                    chapterKeys: [],
                  }))
                }
                disabled={selectedChapterCount === 0}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="quizChapterGroups" role="group" aria-label="Select chapters by book">
            {quizSetupChapterGroups.map((group) => (
              <div key={group.bookId} className="quizChapterGroup">
                <div className="quizChapterGroupHeader">
                  <p className="quizChapterGroupTitle">{group.bookName}</p>
                  <button
                    type="button"
                    className="quizSetupActionBtn"
                    onClick={() =>
                      setQuizSetupSelection((prev) => ({
                        ...prev,
                        chapterKeys: Array.from(new Set([...prev.chapterKeys, ...group.chapters.map((chapter) => chapter.key)])),
                      }))
                    }
                    disabled={group.chapters.length === 0 || group.chapters.every((chapter) => selectedChapterKeysSet.has(chapter.key))}
                  >
                    Select all
                  </button>
                </div>
                <div className="quizChapterPills" role="group" aria-label={`${group.bookName} chapters`}>
                  {group.chapters.map((chapter) => (
                    <button
                      key={chapter.key}
                      type="button"
                      className={`flashWordListItem ${selectedChapterKeysSet.has(chapter.key) ? "isActive" : ""}`}
                      onClick={() => toggleQuizSetupChapter(chapter.key)}
                    >
                      {chapter.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedBookCount > 0 && quizSetupChapterGroups.length === 0 && (
            <p className="quizSetupHint">No chapters found for the selected books.</p>
          )}
          {selectedBookCount > 0 && quizSetupChapterGroups.length > 0 && selectedChapterCount === 0 && (
            <p className="quizSetupHint">Select at least one chapter.</p>
          )}
        </div>
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{quizMode !== "mistake" ? "4. Levels" : "3. Levels"}</span>
            <div className="quizSetupQuickActions">
              <button
                type="button"
                className="quizSetupActionBtn"
                onClick={() =>
                  setQuizSetupSelection((prev) => ({
                    ...prev,
                    difficultyKeys: allDifficultyKeys,
                  }))
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="quizSetupActionBtn"
                onClick={() =>
                  setQuizSetupSelection((prev) => ({
                    ...prev,
                    difficultyKeys: [],
                  }))
                }
                disabled={selectedDifficultyCount === 0}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="quizChapterPills" role="group" aria-label="Select difficulties">
            <button
              type="button"
              className={`flashWordListItem ${selectedDifficultyKeysSet.has("unassigned") ? "isActive" : ""}`}
              onClick={() => toggleQuizSetupDifficulty("unassigned")}
            >
              Unassigned
            </button>
            {WORD_DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`flashWordListItem ${selectedDifficultyKeysSet.has(option.value) ? "isActive" : ""}`}
                onClick={() => toggleQuizSetupDifficulty(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {quizMode === "mistake" && !hasPreviousQuizMistakes && (
          <p className="quizSetupHint">
            No previous quiz mistakes found yet. Complete a regular quiz first.
          </p>
        )}
        {!canStartQuiz && (
          <p className="quizSetupHint">
            Select at least one book, chapter, and difficulty with at least 2 matching words.
          </p>
        )}
        <div className="quizFooter quizSetupFooter">
          <div className="quizSetupSummary">
            <span>Matching words: {quizSetupWords.length}</span>
          </div>
          <button
            type="button"
            className="primaryBtn"
            disabled={!canStartQuiz}
            onClick={startQuizSession}
          >
            Start {quizMode === "typing" ? "Typing Quiz" : quizMode === "blank" ? "Fill in the Blank Quiz" : quizMode === "mistake" ? "Mistake Review" : "Quiz"}
          </button>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- FLASHCARDS ----------
  if (screen === "flashcards") {
    return renderWithSidebar(
      <Flashcards
        currentBook={currentBook}
        goBack={() => setScreen("bookMenu")}
        getBookChapterList={getBookChapterList}
        normalizeWordDifficulty={normalizeWordDifficulty}
        WORD_DIFFICULTY_OPTIONS={WORD_DIFFICULTY_OPTIONS}
        InAppDropdownComponent={InAppDropdown}
        getSelectedDefinition={getSelectedDefinition}
      />
    );
  }

  // ---------- QUIZ ----------
  if (screen === "quiz") {
    return renderWithSidebar(
      <Quiz
        words={activeQuizWords}
        title={activeQuizTitle}
        goBack={() => setScreen(quizBackScreen)}
        mode={activeQuizMode}
        isMistakeReview={activeQuizIsMistakeReview}
        onAwardXp={awardXp}
        onAwardCoins={awardCoins}
        onQuestionCompleted={recordQuizQuestionCompleted}
        onRecordMistake={recordMistakeForWord}
        onResolveMistake={resolveMistakeForWord}
        onQuizComplete={handleQuizComplete}
        buildBlankQuizQuestions={buildBlankQuizQuestions}
        buildQuizQuestions={buildQuizQuestions}
        isEquivalentTypingAnswer={isEquivalentTypingAnswer}
        XP_GAIN_PER_QUIZ_CORRECT={XP_GAIN_PER_QUIZ_CORRECT}
        DEFAULT_CHAPTER_ID={DEFAULT_CHAPTER_ID}
        QUIZ_SUCCESS_PROMPTS={QUIZ_SUCCESS_PROMPTS}
        QUIZ_MISS_PROMPTS={QUIZ_MISS_PROMPTS}
        getQuizCoinReward={getQuizCoinReward}
      />
    );
  }

  // ---------- MISTAKE REVIEW ----------
  if (screen === "mistakeReview") {
    return renderWithSidebar(
      <Quiz
        words={activeQuizWords}
        title={activeQuizTitle}
        goBack={() => setScreen(quizBackScreen)}
        mode={activeQuizMode}
        isMistakeReview={activeQuizIsMistakeReview}
        onAwardXp={awardXp}
        onAwardCoins={awardCoins}
        onQuestionCompleted={recordQuizQuestionCompleted}
        onRecordMistake={recordMistakeForWord}
        onResolveMistake={resolveMistakeForWord}
        onQuizComplete={handleQuizComplete}
        buildBlankQuizQuestions={buildBlankQuizQuestions}
        buildQuizQuestions={buildQuizQuestions}
        isEquivalentTypingAnswer={isEquivalentTypingAnswer}
        XP_GAIN_PER_QUIZ_CORRECT={XP_GAIN_PER_QUIZ_CORRECT}
        DEFAULT_CHAPTER_ID={DEFAULT_CHAPTER_ID}
        QUIZ_SUCCESS_PROMPTS={QUIZ_SUCCESS_PROMPTS}
        QUIZ_MISS_PROMPTS={QUIZ_MISS_PROMPTS}
        getQuizCoinReward={getQuizCoinReward}
      />
    );
  }

  return null;
}
