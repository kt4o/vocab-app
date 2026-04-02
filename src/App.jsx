import { useState, useEffect, useRef, useCallback } from "react";
import { CEFR_WORDLIST } from "./data/cefrWordlist";
import { Flashcards } from "./components/Flashcards";
import { Quiz } from "./components/Quiz";
import { PREMIUM_UPGRADE_ENABLED } from "./config/premium";
import { identifyAnalyticsUser, resetAnalyticsIdentity, trackEvent } from "./lib/analytics.js";
import { useThemeMode } from "./hooks/useThemeMode.js";

const BASE_XP_GAIN_PER_WORD = 20;
const XP_GAIN_PER_QUIZ_CORRECT = 10;
const BASE_XP_PER_LEVEL = 100;
const XP_LEVEL_GROWTH = 1.2;
const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000;
const PRO_DAILY_GOAL_DEFAULT = 30;
const PRO_DAILY_GOAL_MIN = 10;
const PRO_DAILY_GOAL_MAX = 120;
const PRO_DAILY_GOAL_STEP = 5;
const FREE_DAILY_DEFINITION_SESSION_LIMIT = 1;
const FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD = 3;
const FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_LIMIT = 2;
const FREE_DEFINITION_SESSION_WINDOW_MS = 10 * 60 * 1000;
const FREE_DAILY_TYPING_LIMIT = 3;
const FREE_DAILY_MISTAKE_REVIEW_LIMIT = 3;
const WEAK_WORDS_RECENT_DAY_WINDOW = 21;
const WEAK_WORDS_RECENT_QUESTION_WINDOW = 120;
const DEFAULT_CHAPTER_ID = "general";
const WORD_MASTERY_MAX_XP = 10;
const WORD_MASTERY_BAR_STEPS = 5;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;
const STATE_API_PATH = `${API_BASE_URL}/api/state`;
const SOCIAL_API_PATH = `${API_BASE_URL}/api/social`;
const BILLING_API_PATH = `${API_BASE_URL}/api/billing`;
const ANALYTICS_API_PATH = `${API_BASE_URL}/api/analytics`;
const CLOUD_STATE_SYNC_DEBOUNCE_MS = 900;
const AUTH_USERNAME_STORAGE_KEY = "vocab_auth_username";
const COOKIE_SESSION_AUTH_MARKER = "__cookie_session__";
const LEGAL_VERSION = "2026-03-14";
const RETENTION_PING_DAY_KEY_STORAGE = "vocab_retention_ping_day";
const ACCOUNT_DATA_STORAGE_KEYS = [
  "vocab_books",
  "vocab_xp",
  "vocab_levels_enabled",
  "vocab_weekly_stats",
  "vocab_activity_history",
  "vocab_pro_daily_goal_questions",
  "vocab_free_daily_usage",
  "vocab_free_definition_session_usage",
  "vocab_last_quiz_mistakes",
  "vocab_last_quiz_mistakes_by_book",
  "vocab_last_quiz_mistake_mode",
  "vocab_last_quiz_mistake_mode_by_book",
  "vocab_last_quiz_setup",
  "vocab_streak",
  AUTH_USERNAME_STORAGE_KEY,
  RETENTION_PING_DAY_KEY_STORAGE,
];
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

function isBearerAuthToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function buildAuthHeaders(authToken, baseHeaders = {}) {
  const headers = { ...(baseHeaders || {}) };
  if (isBearerAuthToken(authToken)) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function navigateTo(path) {
  const nextPath = String(path || "/").trim() || "/";
  window.history.replaceState(null, "", nextPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatCountdown(ms) {
  const safeMs = Math.max(0, Math.floor(Number(ms) || 0));
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeSubscriptionStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isCanceledSubscriptionStatus(value) {
  const status = normalizeSubscriptionStatus(value);
  return status === "canceled" || status === "cancelled";
}

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
  const lastDate = parsed?.lastDate ? getCurrentDayKey(new Date(parsed.lastDate)) : null;
  return { count, lastDate };
}

function parseStoredBoolean(value, fallbackValue = false) {
  return typeof value === "boolean" ? value : fallbackValue;
}

function parseStoredQuizSetup(rawValue) {
  const parsed = parseJsonSafely(rawValue, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const bookIds = Array.isArray(parsed.bookIds)
    ? Array.from(new Set(parsed.bookIds.map((id) => String(id)).filter(Boolean)))
    : [];
  const chapterKeys = Array.isArray(parsed.chapterKeys)
    ? Array.from(new Set(parsed.chapterKeys.map((key) => String(key)).filter(Boolean)))
    : [];
  const difficultyKeys = Array.isArray(parsed.difficultyKeys)
    ? Array.from(new Set(parsed.difficultyKeys.map((key) => String(key)).filter(Boolean)))
    : [];
  const mode = normalizeQuizMode(parsed.mode, "normal");

  if (bookIds.length === 0 || chapterKeys.length === 0 || difficultyKeys.length === 0) return null;

  return {
    mode,
    bookIds,
    chapterKeys,
    difficultyKeys,
  };
}

function createDefaultFreeDailyUsage(date = new Date()) {
  return {
    dayKey: getCurrentDayKey(date),
    definitionSessionStarts: 0,
    typingAttempts: 0,
    mistakeReviewAttempts: 0,
  };
}

function ensureCurrentFreeDailyUsage(rawUsage, date = new Date()) {
  const safeDayKey = getCurrentDayKey(date);
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) {
    return createDefaultFreeDailyUsage(date);
  }

  const usageDayKey = String(rawUsage.dayKey || "");
  if (!usageDayKey || usageDayKey !== safeDayKey) {
    return createDefaultFreeDailyUsage(date);
  }

  return {
    dayKey: safeDayKey,
    definitionSessionStarts: Math.max(0, Math.floor(Number(rawUsage.definitionSessionStarts) || 0)),
    typingAttempts: Math.max(0, Math.floor(Number(rawUsage.typingAttempts) || 0)),
    mistakeReviewAttempts: Math.max(0, Math.floor(Number(rawUsage.mistakeReviewAttempts) || 0)),
  };
}

function createDefaultFreeDefinitionSessionUsage() {
  return {
    startedAt: 0,
  };
}

function ensureCurrentFreeDefinitionSessionUsage(rawUsage, date = new Date()) {
  const now = date.getTime();
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) {
    return createDefaultFreeDefinitionSessionUsage(date);
  }

  const startedAt = Math.max(0, Math.floor(Number(rawUsage.startedAt) || 0));

  if (!startedAt || now - startedAt >= FREE_DEFINITION_SESSION_WINDOW_MS) {
    return createDefaultFreeDefinitionSessionUsage(date);
  }

  return {
    startedAt,
  };
}

function parseDailyGoalTarget(value) {
  const parsed = Math.floor(Number(value) || PRO_DAILY_GOAL_DEFAULT);
  const clamped = Math.min(PRO_DAILY_GOAL_MAX, Math.max(PRO_DAILY_GOAL_MIN, parsed));
  const offset = clamped - PRO_DAILY_GOAL_MIN;
  return PRO_DAILY_GOAL_MIN + Math.round(offset / PRO_DAILY_GOAL_STEP) * PRO_DAILY_GOAL_STEP;
}

function normalizeTrackedQuizMode(mode) {
  const normalized = String(mode || "")
    .trim()
    .toLowerCase();
  return normalized === "normal" || normalized === "typing" ? normalized : "";
}

function sanitizeWordQuizPerformanceHistory(rawHistory, options = {}) {
  const maxAgeDays = Math.max(
    1,
    Math.floor(Number(options?.maxAgeDays) || WEAK_WORDS_RECENT_DAY_WINDOW)
  );
  const maxEntries = Math.max(
    1,
    Math.floor(Number(options?.maxEntries) || WEAK_WORDS_RECENT_QUESTION_WINDOW)
  );
  const nowTs = Math.max(0, Math.floor(Number(options?.nowTs) || Date.now()));
  const cutoffTs = nowTs - maxAgeDays * 24 * 60 * 60 * 1000;

  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((entry) => {
      const ts = Math.max(0, Math.floor(Number(entry?.ts) || 0));
      const mode = normalizeTrackedQuizMode(entry?.mode);
      if (!ts || !mode) return null;
      return {
        ts,
        mode,
        correct: Boolean(entry?.correct),
      };
    })
    .filter(Boolean)
    .filter((entry) => entry.ts >= cutoffTs)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, maxEntries);
}

function appendWordQuizPerformance(rawHistory, attempt, nowTs = Date.now()) {
  const mode = normalizeTrackedQuizMode(attempt?.mode);
  if (!mode) {
    return sanitizeWordQuizPerformanceHistory(rawHistory, { nowTs });
  }
  const ts = Math.max(0, Math.floor(Number(attempt?.timestamp) || Number(nowTs) || Date.now()));
  const next = [
    {
      ts,
      mode,
      correct: Boolean(attempt?.correct),
    },
    ...(Array.isArray(rawHistory) ? rawHistory : []),
  ];
  return sanitizeWordQuizPerformanceHistory(next, { nowTs: ts });
}

function getWordQuizPerformanceStats(rawHistory) {
  const history = sanitizeWordQuizPerformanceHistory(rawHistory);
  const byMode = {
    normal: { attempts: 0, correct: 0, accuracyPercent: null },
    typing: { attempts: 0, correct: 0, accuracyPercent: null },
  };
  let totalCorrect = 0;

  history.forEach((entry) => {
    byMode[entry.mode].attempts += 1;
    if (entry.correct) {
      byMode[entry.mode].correct += 1;
      totalCorrect += 1;
    }
  });

  Object.keys(byMode).forEach((modeKey) => {
    const modeStats = byMode[modeKey];
    modeStats.accuracyPercent = modeStats.attempts
      ? Math.round((modeStats.correct / modeStats.attempts) * 100)
      : null;
  });

  const totalAttempts = history.length;
  const accuracyPercent = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : null;

  return {
    attempts: totalAttempts,
    correct: totalCorrect,
    accuracyPercent,
    byMode,
    windowDays: WEAK_WORDS_RECENT_DAY_WINDOW,
    windowQuestions: WEAK_WORDS_RECENT_QUESTION_WINDOW,
  };
}

function buildWeakWordCandidates(books) {
  return (books || [])
    .flatMap((book) =>
      (book?.words || [])
        .filter((wordEntry) => getWordDefinitions(wordEntry).length > 0)
        .map((wordEntry) => {
          const mistakeCount = getMistakeCount(wordEntry);
          const masteryXp = getWordMasteryXp(wordEntry);
          const performance = getWordQuizPerformanceStats(wordEntry?.quizPerformanceHistory);
          const normalizedDifficulty = normalizeWordDifficulty(wordEntry?.difficulty);
          const difficultyWeight =
            normalizedDifficulty === "c2"
              ? 3
              : normalizedDifficulty === "c1"
                ? 2.5
                : normalizedDifficulty === "b2"
                  ? 2
                  : normalizedDifficulty === "b1"
                    ? 1.5
                    : normalizedDifficulty === "a2"
                      ? 1
                      : normalizedDifficulty === "a1"
                      ? 0.5
                      : 1;
          const recentAccuracyPenalty = performance.attempts
            ? (100 - (performance.accuracyPercent || 0)) / 10
            : 0;
          const recentAttemptSignal = Math.min(
            performance.attempts,
            WEAK_WORDS_RECENT_QUESTION_WINDOW
          ) * 0.12;
          const weaknessScore =
            mistakeCount * 4 +
            (WORD_MASTERY_MAX_XP - masteryXp) * 1.8 +
            difficultyWeight +
            recentAccuracyPenalty * 3 +
            recentAttemptSignal;

          return {
            ...wordEntry,
            sourceBookId: book.id,
            sourceBookName: String(book?.name || "Book"),
            mistakeCount,
            masteryXp,
            recentAttempts: performance.attempts,
            recentCorrect: performance.correct,
            recentAccuracyPercent: performance.accuracyPercent,
            recentNormalAttempts: performance.byMode.normal.attempts,
            recentNormalAccuracyPercent: performance.byMode.normal.accuracyPercent,
            recentTypingAttempts: performance.byMode.typing.attempts,
            recentTypingAccuracyPercent: performance.byMode.typing.accuracyPercent,
            recentWindowDays: performance.windowDays,
            recentWindowQuestions: performance.windowQuestions,
            weaknessScore,
          };
        })
    )
    .sort(
      (a, b) =>
        b.weaknessScore - a.weaknessScore ||
        b.recentAttempts - a.recentAttempts ||
        b.mistakeCount - a.mistakeCount
    );
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

  // Never repeat the same target word in one quiz, even across different chapters/books.
  const seenWordKeys = new Set();
  baseWords = baseWords.filter((entry) => {
    const wordKey = normalizeQuizAnswer(entry?.word);
    if (!wordKey || seenWordKeys.has(wordKey)) return false;
    seenWordKeys.add(wordKey);
    return true;
  });

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

function getWeekStartDate(date = new Date()) {
  const localDate = new Date(date);
  if (Number.isNaN(localDate.getTime())) return new Date();
  localDate.setHours(0, 0, 0, 0);
  const day = localDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  localDate.setDate(localDate.getDate() + mondayOffset);
  return localDate;
}

function getCurrentWeekKey(date = new Date()) {
  const weekStart = getWeekStartDate(date);
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(weekStart.getDate()).padStart(2, "0");
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
  if (Number.isNaN(localDate.getTime())) return null;
  localDate.setHours(0, 0, 0, 0);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateOfMonth}`;
}

function parseDayKeyToDayIndex(dayKey) {
  if (typeof dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const [year, month, day] = dayKey.split("-").map((item) => Number(item));
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
}

function getDayKeyDifference(fromDayKey, toDayKey) {
  const fromIndex = parseDayKeyToDayIndex(fromDayKey);
  const toIndex = parseDayKeyToDayIndex(toDayKey);
  if (fromIndex === null || toIndex === null) return 0;
  return toIndex - fromIndex;
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

function getWeekTotals(history, date = new Date()) {
  const weekStart = getWeekStartDate(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startKey = getCurrentDayKey(weekStart);
  const endKey = getCurrentDayKey(weekEnd);
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
      masteryXp: getWordMasteryXp(wordEntry),
      quizPerformanceHistory: sanitizeWordQuizPerformanceHistory(wordEntry?.quizPerformanceHistory),
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
  const allowed = new Set(["normal", "typing", "mistake", "smart"]);
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

export default function App() {
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
  const [isLevelsEnabled, setIsLevelsEnabled] = useState(() => {
    const saved = localStorage.getItem("vocab_levels_enabled");
    if (saved === null) return true;
    return saved === "true";
  });
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [bookPendingRename, setBookPendingRename] = useState(null);
  const [renamedBookName, setRenamedBookName] = useState("");
  const [bookPendingDelete, setBookPendingDelete] = useState(null);
  const [chapterPendingDelete, setChapterPendingDelete] = useState(null);
  const [wordPendingDelete, setWordPendingDelete] = useState(null);
  const [friendPendingRemove, setFriendPendingRemove] = useState(null);
  const [noticeModal, setNoticeModal] = useState(null);
  const [quizBackScreen, setQuizBackScreen] = useState("dashboard");
  const [quizMode, setQuizMode] = useState("normal");
  const [quizSetupStep, setQuizSetupStep] = useState(0);
  const [quizSetupSelection, setQuizSetupSelection] = useState({
    bookIds: [],
    chapterKeys: [],
    difficultyKeys: [],
  });
  const [lastQuizSetup, setLastQuizSetup] = useState(() =>
    parseStoredQuizSetup(localStorage.getItem("vocab_last_quiz_setup"))
  );
  const [isQuickQuizSetupArmed, setIsQuickQuizSetupArmed] = useState(false);
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
  const [editingDefinitionKey, setEditingDefinitionKey] = useState("");
  const [editingDefinitionDraft, setEditingDefinitionDraft] = useState("");
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
  const [freeDailyUsage, setFreeDailyUsage] = useState(() =>
    ensureCurrentFreeDailyUsage(parseJsonSafely(localStorage.getItem("vocab_free_daily_usage"), null))
  );
  const [freeDefinitionSessionUsage, setFreeDefinitionSessionUsage] = useState(() =>
    ensureCurrentFreeDefinitionSessionUsage(
      parseJsonSafely(localStorage.getItem("vocab_free_definition_session_usage"), null)
    )
  );
  const [proDailyGoalQuestions, setProDailyGoalQuestions] = useState(() =>
    parseDailyGoalTarget(localStorage.getItem("vocab_pro_daily_goal_questions"))
  );
  const [authToken, setAuthToken] = useState("");
  const [authUsername, setAuthUsername] = useState(
    () => localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || ""
  );
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    acceptedLegal: false,
    marketingOptIn: false,
  });
  const [authError, setAuthError] = useState("");
  const [isAuthSessionResolved, setIsAuthSessionResolved] = useState(false);
  const [billingPlan, setBillingPlan] = useState("free");
  const [billingSubscriptionStatus, setBillingSubscriptionStatus] = useState("");
  const [billingCurrentPeriodEnd, setBillingCurrentPeriodEnd] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [isStripeBillingConfigured, setIsStripeBillingConfigured] = useState(false);
  const [isAccountProfileLoading, setIsAccountProfileLoading] = useState(false);
  const [isBillingStatusLoading, setIsBillingStatusLoading] = useState(false);
  const [isBillingCheckoutSubmitting, setIsBillingCheckoutSubmitting] = useState(false);
  const [isBillingPortalSubmitting, setIsBillingPortalSubmitting] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [accountPanelModal, setAccountPanelModal] = useState("");
  const [isDailyGoalModalOpen, setIsDailyGoalModalOpen] = useState(false);
  const [accountSecurityForm, setAccountSecurityForm] = useState({
    resetEmail: "",
    deletePassword: "",
  });
  const [accountActionError, setAccountActionError] = useState("");
  const [isPasswordChangeSubmitting, setIsPasswordChangeSubmitting] = useState(false);
  const [isLogoutAllSubmitting, setIsLogoutAllSubmitting] = useState(false);
  const [isDeleteAccountSubmitting, setIsDeleteAccountSubmitting] = useState(false);
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [socialOverview, setSocialOverview] = useState(null);
  const [friendUsernameInput, setFriendUsernameInput] = useState("");
  const [socialActionLoadingKey, setSocialActionLoadingKey] = useState("");
  const [socialMetric, setSocialMetric] = useState("wordsAdded");
  const [socialTimeframe, setSocialTimeframe] = useState("weekly");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCloudStateHydrated, setIsCloudStateHydrated] = useState(false);
  const [isLocalPersistencePaused, setIsLocalPersistencePaused] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const modalRef = useRef(null);
  const levelInfoRef = useRef(null);
  const sidebarRef = useRef(null);
  const backupFileInputRef = useRef(null);
  const pronunciationFetchInFlightRef = useRef(new Set());
  const sessionStartedAtRef = useRef(Date.now());
  const lastUserActivityAtRef = useRef(Date.now());
  const pendingMistakeReviewSourceRef = useRef(null);
  const previousSocialFriendCountRef = useRef(null);

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
  const xpMultiplier = 1;
  const currentWordXpGain = Math.max(1, Math.round(getWordXpGain(streak.count) * xpMultiplier));
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
  const activityWeeklyStats = getWeekTotals(activityHistory);
  const activityMonthlyStats = getMonthTotals(activityHistory);
  const activityTotalStats = sumActivityHistory(activityHistory);
  const currentFreeDailyUsage = ensureCurrentFreeDailyUsage(freeDailyUsage);
  const currentFreeDefinitionSessionUsage = ensureCurrentFreeDefinitionSessionUsage(freeDefinitionSessionUsage);
  const socialFriendCount = authToken && Array.isArray(socialOverview?.friends)
    ? socialOverview.friends.length
    : 0;
  const freeDailyDefinitionSessionLimit =
    socialFriendCount >= FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD
      ? FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_LIMIT
      : FREE_DAILY_DEFINITION_SESSION_LIMIT;
  const hasFriendDefinitionSessionBonus =
    freeDailyDefinitionSessionLimit > FREE_DAILY_DEFINITION_SESSION_LIMIT;
  const freeDefinitionSessionsUsedToday = Math.min(
    currentFreeDailyUsage.definitionSessionStarts,
    freeDailyDefinitionSessionLimit
  );
  const freeDefinitionLimitReachedMessage = hasFriendDefinitionSessionBonus
    ? "Free plan limit reached. You have used both 10-minute add-definitions sessions for today."
    : `Free plan limit reached. Add ${FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD} friends in Socials to unlock 2 daily sessions.`;
  const isFreeDefinitionSessionActive =
    countdownNow - currentFreeDefinitionSessionUsage.startedAt < FREE_DEFINITION_SESSION_WINDOW_MS;
  const freeDefinitionSessionRemainingMs = isFreeDefinitionSessionActive
    ? Math.max(
        0,
        currentFreeDefinitionSessionUsage.startedAt + FREE_DEFINITION_SESSION_WINDOW_MS - countdownNow
      )
    : 0;
  const freeDefinitionSessionDisplayMs = isFreeDefinitionSessionActive
    ? freeDefinitionSessionRemainingMs
    : FREE_DEFINITION_SESSION_WINDOW_MS;
  const isAccountDataHydrating = Boolean(authToken) && !isCloudStateHydrated;
  const isProPlan = billingPlan === "pro";
  const weakWordCandidates = buildWeakWordCandidates(books);
  const smartReviewWords = weakWordCandidates.slice(0, 20).map((entry) => ({
    ...entry,
    sourceBookId: entry.sourceBookId ?? null,
  }));
  const proDailyGoalProgress = Math.max(0, Math.floor(Number(activityDailyStats.questionsCompleted) || 0));
  const proDailyGoalPercent = Math.min(
    100,
    Math.round((proDailyGoalProgress / Math.max(proDailyGoalQuestions, 1)) * 100)
  );
  const hasMetProDailyGoal = proDailyGoalProgress >= proDailyGoalQuestions;
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
    const selectedMode = normalizeQuizMode(quizMode, "normal");
    if (selectedMode === "smart") {
      startSmartReviewSession();
      return;
    }
    if (!isProPlan && selectedMode === "typing") {
      const safeUsage = ensureCurrentFreeDailyUsage(freeDailyUsage);
      if (safeUsage.typingAttempts >= FREE_DAILY_TYPING_LIMIT) {
        openNoticeModal(
          `Free plan limit reached: ${FREE_DAILY_TYPING_LIMIT} typing quiz starts per day.`,
          "Daily Limit"
        );
        return;
      }
      setFreeDailyUsage((prev) => {
        const current = ensureCurrentFreeDailyUsage(prev);
        return {
          ...current,
          typingAttempts: current.typingAttempts + 1,
        };
      });
    }

    const nextTitle =
      quizSetupSelection.bookIds.length === 1
        ? books.find((book) => String(book.id) === quizSetupSelection.bookIds[0])?.name || "Quiz"
        : "Multi-Book Quiz";
    const setupSnapshot = {
      mode: selectedMode,
      bookIds: [...quizSetupSelection.bookIds],
      chapterKeys: [...quizSetupSelection.chapterKeys],
      difficultyKeys: [...quizSetupSelection.difficultyKeys],
    };
    setLastQuizSetup(setupSnapshot);
    setIsQuickQuizSetupArmed(false);
    setActiveQuizWords(quizSetupWords);
    setActiveQuizTitle(nextTitle);
    setActiveQuizMode(selectedMode);
    setActiveQuizIsMistakeReview(false);
    trackEvent("quiz_started", {
      quiz_mode: selectedMode,
      word_count: quizSetupWords.length,
      book_count: quizSetupSelection.bookIds.length,
      chapter_count: quizSetupSelection.chapterKeys.length,
      difficulty_count: quizSetupSelection.difficultyKeys.length,
    });
    setScreen("quiz");
  }

  function openSmartReviewSetup() {
    setQuizBackScreen("quizSelect");
    initializeQuizSetupSelection();
    setQuizMode("smart");
    setScreen("quizSelect");
  }

  function startSmartReviewSession() {
    if (!isProPlan) {
      return;
    }
    if (smartReviewWords.length < 2) {
      openNoticeModal("Add more words and quiz activity to generate a Smart Review queue.", "Not Enough Data");
      return;
    }

    setQuizBackScreen("dashboard");
    setActiveQuizWords(smartReviewWords);
    setActiveQuizTitle("Smart Review");
    setActiveQuizMode("normal");
    setActiveQuizIsMistakeReview(false);
    trackEvent("smart_review_started", {
      word_count: smartReviewWords.length,
    });
    setScreen("quiz");
  }

  function exportWeakWordsCsv() {
    if (!isProPlan) {
      return;
    }
    if (!weakWordCandidates.length) {
      openNoticeModal("No weak-word data yet. Complete some quizzes first.", "No Data");
      return;
    }

    const header = [
      "word",
      "book",
      "mistakes",
      "masteryXp",
      "recentAttempts",
      "recentAccuracyPercent",
      "mcAccuracyPercent",
      "typingAccuracyPercent",
      "weaknessScore",
    ];
    const rows = weakWordCandidates.slice(0, 200).map((entry) => [
      String(entry.word || ""),
      String(entry.sourceBookName || ""),
      String(entry.mistakeCount || 0),
      String(entry.masteryXp || 0),
      String(entry.recentAttempts || 0),
      entry.recentAccuracyPercent === null || entry.recentAccuracyPercent === undefined
        ? ""
        : String(entry.recentAccuracyPercent),
      entry.recentNormalAccuracyPercent === null || entry.recentNormalAccuracyPercent === undefined
        ? ""
        : String(entry.recentNormalAccuracyPercent),
      entry.recentTypingAccuracyPercent === null || entry.recentTypingAccuracyPercent === undefined
        ? ""
        : String(entry.recentTypingAccuracyPercent),
      String(Math.round(Number(entry.weaknessScore) || 0)),
    ]);
    const csvContent = [header, ...rows]
      .map((cols) =>
        cols
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const dateStamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `weak-words-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    openNoticeModal("Weak words CSV exported.", "Export Complete");
  }

  const startMistakeReviewSession = useCallback((source = "global") => {
    if (!isProPlan) {
      const safeUsage = ensureCurrentFreeDailyUsage(freeDailyUsage);
      if (safeUsage.mistakeReviewAttempts >= FREE_DAILY_MISTAKE_REVIEW_LIMIT) {
        openNoticeModal(
          `Free plan limit reached: ${FREE_DAILY_MISTAKE_REVIEW_LIMIT} mistake review starts per day.`,
          "Daily Limit"
        );
        return;
      }
    }

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
    if (!isProPlan) {
      setFreeDailyUsage((prev) => {
        const current = ensureCurrentFreeDailyUsage(prev);
        return {
          ...current,
          mistakeReviewAttempts: current.mistakeReviewAttempts + 1,
        };
      });
    }
    pendingMistakeReviewSourceRef.current = null;
    setScreen("mistakeReview");
  }, [books, currentBookId, freeDailyUsage, isProPlan, lastQuizMistakeKeysByBook, lastQuizMistakeKeys, lastQuizMistakeModeByBook, lastQuizMistakeMode]);

  const requestMistakeReview = useCallback((source = "global") => {
    pendingMistakeReviewSourceRef.current = source;
    startMistakeReviewSession(source);
  }, [startMistakeReviewSession]);

  function renderWithSidebar(content) {
    const inDefinitions =
      screen === "definitions" || screen === "definitionsSelect" || screen === "chapters";
    const inFlashcards = screen === "flashcards" || screen === "flashcardsSelect";
    const inQuiz = screen === "quiz" || screen === "quizSelect";
    const inSocial = screen === "socialLeaderboard" || screen === "socialFriends";
    const showActiveRecentBook =
      screen === "bookMenu" ||
      screen === "chapters" ||
      screen === "definitions" ||
      screen === "flashcards" ||
      screen === "quiz" ||
      screen === "mistakeReview";

    const mainContent = isAccountDataHydrating ? (
      <div className="page accountPage">
        <div className="pageHeader">
          <h1>Syncing Account</h1>
        </div>
        <div className="analyticsSection">
          <div className="analyticsCard settingsCard accountSyncCard">
            <div className="spinner" aria-hidden="true"></div>
            <h3>Loading your account data</h3>
            <p className="settingsHint">
              Your books, progress, and account settings are syncing for this session.
            </p>
          </div>
        </div>
      </div>
    ) : content;

    return (
      <div className="appShell">
        <aside ref={sidebarRef} className={`sidebar ${isSidebarHidden ? "isCollapsed" : ""}`}>
          <div className="sidebarTopRow">
            {!isSidebarHidden && (
              <div className="sidebarBrandWrap">
                <div className="sidebarBrand">Vocalibry</div>
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
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDCD8"}</span>
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
                className={`sidebarNavBtn ${inSocial ? "isActive" : ""}`}
                onClick={() => setScreen("socialLeaderboard")}
              >
                <span className="sidebarNavBtnLabel">Socials</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDC65"}</span>
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
                      className={`sidebarBookBtn ${
                        currentBookId === book.id && showActiveRecentBook ? "isActive" : ""
                      }`}
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
        <main className="appMain">{mainContent}</main>
      </div>
    );
  }

  useEffect(() => {
    if (!isSidebarHidden) return;
    if (!sidebarRef.current) return;
    sidebarRef.current.scrollTop = 0;
  }, [isSidebarHidden]);

  useEffect(() => {
    if (isLocalPersistencePaused) return;
    const persistedState = {
      vocab_books: JSON.stringify(books),
      vocab_xp: JSON.stringify(xp),
      vocab_levels_enabled: String(isLevelsEnabled),
      vocab_theme: theme,
      vocab_sidebar_hidden: JSON.stringify(isSidebarHidden),
      vocab_weekly_stats: JSON.stringify(weeklyStats),
      vocab_activity_history: JSON.stringify(activityHistory),
      vocab_pro_daily_goal_questions: JSON.stringify(proDailyGoalQuestions),
      vocab_free_daily_usage: JSON.stringify(freeDailyUsage),
      vocab_free_definition_session_usage: JSON.stringify(freeDefinitionSessionUsage),
      vocab_last_quiz_mistakes: JSON.stringify(lastQuizMistakeKeys),
      vocab_last_quiz_mistakes_by_book: JSON.stringify(lastQuizMistakeKeysByBook),
      vocab_last_quiz_mistake_mode: lastQuizMistakeMode,
      vocab_last_quiz_mistake_mode_by_book: JSON.stringify(lastQuizMistakeModeByBook),
      vocab_last_quiz_setup: JSON.stringify(lastQuizSetup),
      vocab_streak: JSON.stringify(streak),
      [AUTH_USERNAME_STORAGE_KEY]: authUsername,
    };

    Object.entries(persistedState).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    localStorage.removeItem("vocab_auth_token");
  }, [
    books,
    xp,
    isLevelsEnabled,
    theme,
    isSidebarHidden,
    weeklyStats,
    activityHistory,
    proDailyGoalQuestions,
    freeDailyUsage,
    freeDefinitionSessionUsage,
    lastQuizMistakeKeys,
    lastQuizMistakeKeysByBook,
    lastQuizMistakeMode,
    lastQuizMistakeModeByBook,
    lastQuizSetup,
    streak,
    authUsername,
    isLocalPersistencePaused,
  ]);

  async function submitAuth(mode) {
    const email = String(authForm.email || "")
      .trim()
      .toLowerCase();
    const username = String(authForm.username || "")
      .trim()
      .toLowerCase();
    const password = String(authForm.password || "");
    const confirmPassword = String(authForm.confirmPassword || "");

    if (!username || !password) {
      setAuthError("Username or email and password are required.");
      return;
    }
    if (mode === "register" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (mode === "register" && !authForm.acceptedLegal) {
      setAuthError("Please accept Terms, Privacy Policy, and Disclaimer.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      const endpoint = mode === "register" ? "register" : "login";
      const response = await fetch(`${AUTH_API_PATH}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? {
                email,
                username,
                password,
                marketingOptIn: Boolean(authForm.marketingOptIn),
                acceptedLegal: Boolean(authForm.acceptedLegal),
                legalVersion: LEGAL_VERSION,
              }
            : { identifier: username, username, password }
        ),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "");
        const nextError =
          backendError === "invalid-email"
            ? "Enter a valid email address."
            : backendError === "email-taken"
              ? "That email is already connected to an account."
              : backendError === "email-not-verified"
                ? "Verify your email on the Register page before creating an account."
                : backendError === "legal-not-accepted"
                  ? "Please accept Terms, Privacy Policy, and Disclaimer."
                : backendError === "invalid-username"
                  ? "Use 3-24 chars: lowercase letters, numbers, underscore."
                  : backendError === "inappropriate-username"
                    ? "Choose a different username. Inappropriate names are not allowed."
                  : backendError === "weak-password"
                    ? "Password must be at least 8 characters."
                    : backendError === "username-taken"
                      ? "That username is already taken."
                      : backendError === "invalid-credentials"
                        ? "Incorrect username/email or password."
                        : "Could not sign in. Please try again.";
        setAuthError(nextError);
        return;
      }

      const nextUsername = String(payload?.username || username).trim().toLowerCase();
      const safeUserId = Number(payload?.userId);
      setAuthToken(COOKIE_SESSION_AUTH_MARKER);
      setAuthUsername(nextUsername);
      if (Number.isFinite(safeUserId) && safeUserId > 0) {
        identifyAnalyticsUser(safeUserId, {
          username: nextUsername,
          auth_method: "password",
        });
      }
      setAuthForm({
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        acceptedLegal: false,
        marketingOptIn: false,
      });
      openNoticeModal(`Signed in as ${nextUsername}.`, "Account Ready");
    } catch {
      setAuthError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  const clearPersistedAccountData = useCallback(() => {
    ACCOUNT_DATA_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  }, []);

  const logoutAccount = useCallback(async ({ clearLocalData = false } = {}) => {
    try {
      await fetch(`${AUTH_API_PATH}/logout`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, { "Content-Type": "application/json" }),
      });
    } catch {
      // Keep local logout reliable even if backend is temporarily unavailable.
    }
    setAuthToken("");
    setAuthUsername("");
    resetAnalyticsIdentity();
    localStorage.removeItem("vocab_auth_token");
    if (clearLocalData) {
      setIsLocalPersistencePaused(true);
      clearPersistedAccountData();
      resetAppDataToDefaults();
    } else {
      setIsLocalPersistencePaused(false);
    }
    setAccountEmail("");
    setAuthError("");
    setBillingPlan("free");
    setBillingSubscriptionStatus("");
    setBillingCurrentPeriodEnd("");
    setIsStripeBillingConfigured(false);
    setIsAccountProfileLoading(false);
    setFriendPendingRemove(null);
    setSocialOverview(null);
    setSocialError("");
    setAccountActionError("");
    setIsChangePasswordModalOpen(false);
    setIsDailyGoalModalOpen(false);
    setAuthForm({
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      acceptedLegal: false,
      marketingOptIn: false,
    });
    setAccountSecurityForm({
      resetEmail: "",
      deletePassword: "",
    });
    setIsCloudStateHydrated(false);
    setIsDeleteAccountConfirmOpen(false);
    navigateTo("/login");
  }, [authToken, clearPersistedAccountData]);

  useEffect(() => {
    if (authToken) {
      setIsAuthSessionResolved(true);
      return;
    }
    let cancelled = false;
    async function restoreCookieSession() {
      try {
        const response = await fetch(`${AUTH_API_PATH}/account`, {
          credentials: "include",
        });
        if (!response.ok || cancelled) return;
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        const nextUsername = String(payload?.username || "").trim().toLowerCase();
        const nextEmail = String(payload?.email || "").trim().toLowerCase();
        const safeUserId = Number(payload?.userId);
        setAuthToken(COOKIE_SESSION_AUTH_MARKER);
        if (nextUsername) setAuthUsername(nextUsername);
        setAccountEmail(nextEmail);
        if (Number.isFinite(safeUserId) && safeUserId > 0) {
          identifyAnalyticsUser(safeUserId, {
            username: nextUsername,
            auth_method: "session_restore",
          });
        }
      } catch {
        // Keep local-only mode available if session restore fails.
      } finally {
        if (!cancelled) {
          setIsAuthSessionResolved(true);
        }
      }
    }
    void restoreCookieSession();
    return () => {
      cancelled = true;
    };
  }, [authToken, logoutAccount]);

  useEffect(() => {
    if (!isAuthSessionResolved || authToken) return;
    navigateTo("/login");
  }, [authToken, isAuthSessionResolved]);

  const loadAccountProfile = useCallback(async () => {
    if (!authToken) return;
    setIsAccountProfileLoading(true);
    try {
      const response = await fetch(`${AUTH_API_PATH}/account`, {
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) return;

      const nextUsername = String(payload?.username || "").trim().toLowerCase();
      const nextEmail = String(payload?.email || "").trim().toLowerCase();
      const safeUserId = Number(payload?.userId);
      if (nextUsername) setAuthUsername(nextUsername);
      setAccountEmail(nextEmail);
      if (Number.isFinite(safeUserId) && safeUserId > 0) {
        identifyAnalyticsUser(safeUserId, {
          username: nextUsername,
          auth_method: "session_refresh",
        });
      }
    } finally {
      setIsAccountProfileLoading(false);
    }
  }, [authToken, logoutAccount]);

  function mapBillingApiError(payload, fallbackMessage) {
    const backendError = String(payload?.error || "").trim().toLowerCase();
    if (backendError === "billing-not-configured") {
      return "Stripe billing is not configured on the backend yet.";
    }
    if (backendError === "email-required-for-billing") {
      return "This account needs an email before billing can be enabled.";
    }
    if (backendError === "already-on-paid-plan") {
      return "This account is already on the paid plan.";
    }
    if (backendError === "billing-customer-missing") {
      return "No Stripe billing profile exists for this account yet.";
    }
    if (backendError === "missing-auth-token" || backendError === "invalid-auth-token") {
      return "Your session expired. Please log in again.";
    }
    return fallbackMessage;
  }

  const loadBillingStatus = useCallback(async () => {
    if (!authToken) return;
    setIsBillingStatusLoading(true);
    try {
      const response = await fetch(`${BILLING_API_PATH}/status`, {
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAuthToken("");
        setAuthUsername("");
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        return;
      }

      setBillingPlan(String(payload?.plan || "free").trim().toLowerCase() === "pro" ? "pro" : "free");
      setBillingSubscriptionStatus(String(payload?.subscriptionStatus || "").trim().toLowerCase());
      setBillingCurrentPeriodEnd(String(payload?.currentPeriodEnd || "").trim());
      setIsStripeBillingConfigured(Boolean(payload?.isStripeConfigured));
    } finally {
      setIsBillingStatusLoading(false);
    }
  }, [authToken]);

  async function startBillingCheckout() {
    if (
      !PREMIUM_UPGRADE_ENABLED ||
      !authToken ||
      isBillingCheckoutSubmitting ||
      billingPlan === "pro"
    ) {
      return;
    }
    setIsBillingCheckoutSubmitting(true);
    setAccountActionError("");
    try {
      const response = await fetch(`${BILLING_API_PATH}/checkout-session`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        setAccountActionError(
          mapBillingApiError(payload, "Could not start Stripe checkout. Please try again.")
        );
        return;
      }

      const checkoutUrl = String(payload?.url || "").trim();
      if (!checkoutUrl) {
        setAccountActionError("Stripe checkout URL was not returned by the backend.");
        return;
      }
      window.location.assign(checkoutUrl);
    } catch {
      setAccountActionError("Could not reach billing service. Check backend and try again.");
    } finally {
      setIsBillingCheckoutSubmitting(false);
    }
  }

  async function openBillingPortal() {
    if (!authToken || isBillingPortalSubmitting) return;
    setIsBillingPortalSubmitting(true);
    setAccountActionError("");
    try {
      const response = await fetch(`${BILLING_API_PATH}/portal-session`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        setAccountActionError(
          mapBillingApiError(payload, "Could not open billing portal. Please try again.")
        );
        return;
      }

      const portalUrl = String(payload?.url || "").trim();
      if (!portalUrl) {
        setAccountActionError("Stripe billing portal URL was not returned by the backend.");
        return;
      }
      window.location.assign(portalUrl);
    } catch {
      setAccountActionError("Could not reach billing service. Check backend and try again.");
    } finally {
      setIsBillingPortalSubmitting(false);
    }
  }

  function mapAccountApiError(payload, fallbackMessage) {
    const backendError = String(payload?.error || "").trim().toLowerCase();
    if (backendError === "invalid-current-password") return "Current password is incorrect.";
    if (backendError === "weak-password") return "New password must be at least 8 characters.";
    if (backendError === "new-password-same-as-current") return "Use a different new password.";
    if (backendError === "pro-subscription-active") {
      return "Cancel your Pro subscription first. Account deletion is available only after status is canceled.";
    }
    if (backendError === "missing-auth-token" || backendError === "invalid-auth-token") {
      return "Your session expired. Please log in again.";
    }
    return fallbackMessage;
  }

  async function changeAccountPassword() {
    if (isPasswordChangeSubmitting || !authToken) return false;
    const normalizedEmail = String(accountSecurityForm.resetEmail || "")
      .trim()
      .toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isValidEmail) {
      setAccountActionError("Enter a valid account email.");
      return false;
    }
    const expectedAccountEmail = String(accountEmail || "")
      .trim()
      .toLowerCase();
    if (!expectedAccountEmail) {
      setAccountActionError("No account email found. Please refresh and try again.");
      return false;
    }
    if (normalizedEmail !== expectedAccountEmail) {
      setAccountActionError("Enter the email associated with this account.");
      return false;
    }

    setIsPasswordChangeSubmitting(true);
    setAccountActionError("");

    try {
      const response = await fetch(`${AUTH_API_PATH}/password-reset/request-code`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return false;
      }
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const retryAfterSeconds = Number(payload?.retryAfterSeconds || 0);
        if (backendError === "password-reset-code-cooldown" && retryAfterSeconds > 0) {
          setAccountActionError(
            `Please wait ${Math.max(1, retryAfterSeconds)}s before requesting another reset email.`
          );
          return false;
        }
        if (backendError === "email-delivery-not-configured") {
          setAccountActionError("Email delivery is not configured on the backend.");
          return false;
        }
        if (backendError === "invalid-email") {
          setAccountActionError("Enter a valid account email.");
          return false;
        }
        if (backendError === "email-mismatch-for-account") {
          setAccountActionError("Enter the email associated with this account.");
          return false;
        }
        setAccountActionError("Could not send password reset email. Please try again.");
        return false;
      }

      openNoticeModal("If this email exists, a reset code has been sent. Check your inbox.", "Password Reset");
      return true;
    } catch {
      setAccountActionError("Could not reach auth service. Check backend and try again.");
      return false;
    } finally {
      setIsPasswordChangeSubmitting(false);
    }
  }

  async function logoutAllDevices() {
    if (isLogoutAllSubmitting || !authToken) return;
    setIsLogoutAllSubmitting(true);
    setAccountActionError("");

    try {
      const response = await fetch(`${AUTH_API_PATH}/account/logout-all`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        setAccountActionError(
          mapAccountApiError(payload, "Could not log out all devices. Please try again.")
        );
        return;
      }

      logoutAccount({ clearLocalData: true });
      openNoticeModal("All sessions have been signed out.", "Session Cleared");
    } catch {
      setAccountActionError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsLogoutAllSubmitting(false);
    }
  }

  function askDeleteAccountConfirmation() {
    if (isDeleteAccountSubmitting || !authToken) return;
    if (billingPlan === "pro" && !isCanceledSubscriptionStatus(billingSubscriptionStatus)) {
      setAccountActionError(
        "Cancel your Pro subscription first. Account deletion is available only after status is canceled."
      );
      return;
    }
    const password = String(accountSecurityForm.deletePassword || "");
    if (!password) {
      setAccountActionError("Enter your password to delete your account.");
      return;
    }
    setAccountActionError("");
    setIsDeleteAccountConfirmOpen(true);
  }

  async function deleteAccountPermanently() {
    if (isDeleteAccountSubmitting || !authToken) return;
    if (billingPlan === "pro" && !isCanceledSubscriptionStatus(billingSubscriptionStatus)) {
      setAccountActionError(
        "Cancel your Pro subscription first. Account deletion is available only after status is canceled."
      );
      return;
    }
    const password = String(accountSecurityForm.deletePassword || "");
    if (!password) {
      setAccountActionError("Enter your password to delete your account.");
      return;
    }
    setIsDeleteAccountConfirmOpen(false);

    setIsDeleteAccountSubmitting(true);
    setAccountActionError("");
    try {
      const response = await fetch(`${AUTH_API_PATH}/account`, {
        method: "DELETE",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      const backendError = String(payload?.error || "").trim().toLowerCase();
      const isAuthTokenError = backendError === "missing-auth-token" || backendError === "invalid-auth-token";
      if (response.status === 401 && isAuthTokenError) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        setAccountActionError(
          mapAccountApiError(payload, "Could not delete account. Please try again.")
        );
        return;
      }

      logoutAccount({ clearLocalData: true });
      openNoticeModal("Your account was deleted.", "Account Removed");
    } catch {
      setAccountActionError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsDeleteAccountSubmitting(false);
    }
  }

  const requestSocial = useCallback(async (path, options = {}) => {
    if (!authToken) return { ok: false, status: 401, payload: { error: "missing-auth-token" } };
    try {
      const response = await fetch(`${SOCIAL_API_PATH}${path}`, {
        ...options,
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, payload };
    } catch {
      return { ok: false, status: 0, payload: { error: "network-error" } };
    }
  }, [authToken]);

  function mapSocialError(payload, fallback = "Could not complete social action.") {
    const code = String(payload?.error || "").trim().toLowerCase();
    if (code === "missing-auth-token" || code === "invalid-auth-token") {
      return "Your session expired. Please log in again.";
    }
    if (code === "invalid-username") return "Use a valid username (a-z, 0-9, _).";
    if (code === "user-not-found") return "That user was not found.";
    if (code === "cannot-add-self") return "You cannot add yourself.";
    if (code === "already-friends") return "You are already friends.";
    if (code === "request-already-pending") return "A friend request is already pending.";
    if (code === "request-not-pending") return "That request is no longer pending.";
    return fallback;
  }

  const loadSocialOverview = useCallback(async () => {
    if (!authToken) return;
    setIsSocialLoading(true);
    setSocialError("");
    const result = await requestSocial("/overview", { method: "GET" });
    if (result.status === 401) {
      logoutAccount();
      setAuthError("Your session expired. Please log in again.");
      setIsSocialLoading(false);
      return;
    }
    if (!result.ok) {
      setSocialError(mapSocialError(result.payload, "Could not load social data."));
      setIsSocialLoading(false);
      return;
    }
    setSocialOverview(result.payload || null);
    setIsSocialLoading(false);
  }, [authToken, logoutAccount, requestSocial]);

  async function sendFriendRequest() {
    if (!authToken || socialActionLoadingKey) return;
    const username = String(friendUsernameInput || "").trim().toLowerCase();
    if (!username) {
      setSocialError("Enter a username to add.");
      return;
    }
    setSocialActionLoadingKey("send-request");
    setSocialError("");
    const result = await requestSocial("/requests", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    if (result.status === 401) {
      logoutAccount();
      setAuthError("Your session expired. Please log in again.");
      setSocialActionLoadingKey("");
      return;
    }
    if (!result.ok) {
      setSocialError(mapSocialError(result.payload, "Could not send request."));
      setSocialActionLoadingKey("");
      return;
    }
    setFriendUsernameInput("");
    await loadSocialOverview();
    setSocialActionLoadingKey("");
  }

  async function respondToFriendRequest(requestId, action) {
    if (!authToken || socialActionLoadingKey) return;
    const safeAction = action === "accept" ? "accept" : "decline";
    setSocialActionLoadingKey(`respond-${requestId}-${safeAction}`);
    setSocialError("");
    const result = await requestSocial(`/requests/${requestId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action: safeAction }),
    });
    if (result.status === 401) {
      logoutAccount();
      setAuthError("Your session expired. Please log in again.");
      setSocialActionLoadingKey("");
      return;
    }
    if (!result.ok) {
      setSocialError(mapSocialError(result.payload, "Could not respond to request."));
      setSocialActionLoadingKey("");
      return;
    }
    await loadSocialOverview();
    setSocialActionLoadingKey("");
  }

  async function cancelOutgoingFriendRequest(requestId) {
    if (!authToken || socialActionLoadingKey) return;
    setSocialActionLoadingKey(`cancel-request-${requestId}`);
    setSocialError("");
    const result = await requestSocial(`/requests/${requestId}`, {
      method: "DELETE",
    });
    if (result.status === 401) {
      logoutAccount();
      setAuthError("Your session expired. Please log in again.");
      setSocialActionLoadingKey("");
      return;
    }
    if (!result.ok) {
      setSocialError(mapSocialError(result.payload, "Could not cancel request."));
      setSocialActionLoadingKey("");
      return;
    }
    await loadSocialOverview();
    setSocialActionLoadingKey("");
  }

  function askRemoveFriend(friendProfile) {
    if (!friendProfile) return;
    const userId = Number(friendProfile.userId);
    if (!Number.isFinite(userId)) return;
    setFriendPendingRemove({
      userId,
      username: String(friendProfile.username || ""),
    });
  }

  async function confirmRemoveFriend() {
    if (!friendPendingRemove) return;
    const friendUserId = friendPendingRemove.userId;
    setFriendPendingRemove(null);
    if (!authToken || socialActionLoadingKey) return;
    setSocialActionLoadingKey(`remove-${friendUserId}`);
    setSocialError("");
    const result = await requestSocial(`/friends/${encodeURIComponent(friendUserId)}`, {
      method: "DELETE",
    });
    if (result.status === 401) {
      logoutAccount();
      setAuthError("Your session expired. Please log in again.");
      setSocialActionLoadingKey("");
      return;
    }
    if (!result.ok) {
      setSocialError(mapSocialError(result.payload, "Could not remove friend."));
      setSocialActionLoadingKey("");
      return;
    }
    await loadSocialOverview();
    setSocialActionLoadingKey("");
  }

  useEffect(() => {
    const onSocialScreen = screen === "socialLeaderboard" || screen === "socialFriends";
    if (!onSocialScreen) return;
    if (!authToken) return;
    loadSocialOverview();
  }, [screen, authToken, loadSocialOverview]);

  useEffect(() => {
    if (!authToken) {
      previousSocialFriendCountRef.current = null;
      return;
    }
    if (isProPlan) {
      previousSocialFriendCountRef.current = socialFriendCount;
      return;
    }
    const previousCount = previousSocialFriendCountRef.current;
    if (previousCount == null) {
      previousSocialFriendCountRef.current = socialFriendCount;
      return;
    }

    const crossedUnlockThreshold =
      previousCount < FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD &&
      socialFriendCount >= FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD;
    previousSocialFriendCountRef.current = socialFriendCount;

    if (!crossedUnlockThreshold) return;

    const noticeUserKey = String(socialOverview?.currentUser?.userId || authUsername || "").trim();
    if (!noticeUserKey) {
      openNoticeModal(
        "Nice! You unlocked 2 daily 10-minute definition sessions.",
        "Friend Bonus Unlocked"
      );
      return;
    }
    const storageKey = `vocab_friend_bonus_notice_seen_${noticeUserKey}`;
    if (localStorage.getItem(storageKey) === "1") return;
    localStorage.setItem(storageKey, "1");
    openNoticeModal(
      "Nice! You unlocked 2 daily 10-minute definition sessions.",
      "Friend Bonus Unlocked"
    );
  }, [authToken, authUsername, isProPlan, socialFriendCount, socialOverview?.currentUser?.userId]);

  useEffect(() => {
    if (!authToken) {
      setBillingPlan("free");
      setBillingSubscriptionStatus("");
      setBillingCurrentPeriodEnd("");
      setAccountEmail("");
      setIsStripeBillingConfigured(false);
      setIsChangePasswordModalOpen(false);
      setIsDailyGoalModalOpen(false);
      setIsBillingStatusLoading(false);
      setIsAccountProfileLoading(false);
      setSocialOverview(null);
      setSocialError("");
      setIsSocialLoading(false);
      return;
    }
    void loadBillingStatus();
    void loadAccountProfile();
    void loadSocialOverview();
  }, [authToken, loadBillingStatus, loadAccountProfile, loadSocialOverview]);

  useEffect(() => {
    if (!authToken) return;
    const params = new URLSearchParams(window.location.search);
    const billingResult = String(params.get("billing") || "").trim().toLowerCase();
    if (!billingResult) return;

    if (billingResult === "success") {
      openNoticeModal("Checkout complete. Your plan has been updated.", "Billing Updated");
    } else if (billingResult === "cancel") {
      openNoticeModal("Checkout was canceled. You are still on the free plan.", "Billing Canceled");
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState(null, "", cleanUrl);
    void loadBillingStatus();
  }, [authToken, loadBillingStatus]);

  useEffect(() => {
    if (!authToken) return;
    const dayKey = getCurrentDayKey(new Date());
    if (!dayKey) return;
    const storedDayKey = String(localStorage.getItem(RETENTION_PING_DAY_KEY_STORAGE) || "").trim();
    if (storedDayKey === dayKey) return;

    let cancelled = false;
    const pingRetention = async () => {
      try {
        const response = await fetch(`${ANALYTICS_API_PATH}/retention/ping`, {
          method: "POST",
          credentials: "include",
          headers: buildAuthHeaders(authToken, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            eventName: "session_start",
            dayKey,
            metadata: { source: "app/client" },
          }),
        });
        if (!cancelled && response.ok) {
          localStorage.setItem(RETENTION_PING_DAY_KEY_STORAGE, dayKey);
        }
      } catch {
        // Ignore retention ping errors to keep UX uninterrupted.
      }
    };

    void pingRetention();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  function getProfileStatsForPeriod(profile, period = "weekly") {
    const safePeriod =
      period === "monthly" || period === "yearly" || period === "total" ? period : "weekly";
    const statsRoot =
      profile?.stats && typeof profile.stats === "object" && !Array.isArray(profile.stats)
        ? profile.stats
        : {};
    const bucket =
      statsRoot[safePeriod] && typeof statsRoot[safePeriod] === "object"
        ? statsRoot[safePeriod]
        : {};
    return {
      wordsAdded: Math.max(0, Math.floor(Number(bucket?.wordsAdded) || 0)),
      questionsCompleted: Math.max(0, Math.floor(Number(bucket?.questionsCompleted) || 0)),
      timeSpentSeconds: Math.max(0, Math.floor(Number(bucket?.timeSpentSeconds) || 0)),
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrateCloudState() {
      if (!authToken) {
        setIsCloudStateHydrated(false);
        return;
      }

      setIsLocalPersistencePaused(true);
      resetAppDataToDefaults();
      setIsCloudStateHydrated(false);

      try {
        const response = await fetch(STATE_API_PATH, {
          credentials: "include",
          headers: buildAuthHeaders(authToken),
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
        if (!cancelled) {
          setIsCloudStateHydrated(true);
          setIsLocalPersistencePaused(false);
        }
      } catch {
        // Keep local state when cloud sync is unavailable.
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
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          appState: {
            backupVersion: 1,
            exportedAt: new Date().toISOString(),
            data: {
              theme,
              books,
              streak,
              xp,
              isLevelsEnabled,
              isSidebarHidden,
              weeklyStats,
              activityHistory,
              lastQuizMistakeKeys,
              lastQuizMistakeKeysByBook,
              lastQuizMistakeMode,
              lastQuizMistakeModeByBook,
            },
          },
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
    isLevelsEnabled,
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
    if (authToken) return;
    setIsLocalPersistencePaused(false);
  }, [authToken]);

  useThemeMode(theme);

  useEffect(() => {
    if (isLevelsEnabled) return;
    setIsLevelInfoOpen(false);
  }, [isLevelsEnabled]);

  useEffect(() => {
    if (!isFreeDefinitionSessionActive) return undefined;
    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isFreeDefinitionSessionActive]);

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
    setDifficultyInfoWord("");
    setNewChapterName("");
    setSelectedChapterIdForNewWords(fallbackChapterId);
  }, [currentBookId, screen, fallbackChapterId]);

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
    setQuizSetupStep(0);
    if (pendingMistakeReviewSourceRef.current) {
      const source = pendingMistakeReviewSourceRef.current;
      startMistakeReviewSession(source);
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
  }, [screen, books, quizMode, quizBackScreen, startMistakeReviewSession]);

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

      if (isLevelInfoOpen && levelInfoRef.current && !levelInfoRef.current.contains(target)) {
        setIsLevelInfoOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isLevelInfoOpen]);

  // Streak logic
  function updateStreak() {
    const todayDayKey = getCurrentDayKey();
    if (!todayDayKey) return;

    const previousCount = Math.max(1, Math.floor(Number(streak.count) || 1));
    const lastDayKey = streak.lastDate;

    let nextCount = previousCount;

    if (!lastDayKey) {
      nextCount = 1;
    } else {
      const dayGap = getDayKeyDifference(lastDayKey, todayDayKey);
      if (dayGap <= 0) return;
      if (dayGap === 1) {
        nextCount += 1;
      } else if (dayGap > 1) {
        nextCount = 1;
      }
    }

    setStreak({
      count: nextCount,
      lastDate: todayDayKey,
    });
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

  function openRenameBookModal(book) {
    if (!book) return;
    setBookPendingRename(book);
    setRenamedBookName(String(book.name || ""));
  }

  function confirmRenameBook() {
    if (!bookPendingRename) return;
    const nextName = renamedBookName.trim();
    if (!nextName) return;

    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        book.id === bookPendingRename.id
          ? {
              ...book,
              name: nextName,
            }
          : book
      )
    );
    setBookPendingRename(null);
    setRenamedBookName("");
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

  function askDeleteWord(wordEntry, wordIndex) {
    if (!wordEntry || !Number.isInteger(wordIndex)) return;
    const mastery = getWordMasteryMeta(wordEntry);
    if (mastery.level <= 1) {
      deleteWord(wordEntry.word, wordIndex);
      return;
    }

    setWordPendingDelete({
      word: wordEntry.word,
      index: wordIndex,
      level: mastery.level,
      label: mastery.label,
    });
  }

  function confirmDeleteWord() {
    if (!wordPendingDelete) return;
    deleteWord(wordPendingDelete.word, wordPendingDelete.index);
    setWordPendingDelete(null);
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
    const importedStreak = parseStoredStreak(JSON.stringify(rawData?.streak || null));
    const importedXp = Math.max(0, Math.floor(Number(rawData?.xp) || 0));
    const importedIsLevelsEnabled = parseStoredBoolean(rawData?.isLevelsEnabled, true);
    const importedSidebarHidden = parseStoredBoolean(rawData?.isSidebarHidden, false);
    const importedWeeklyStats = parseStoredWeeklyStats(JSON.stringify(rawData?.weeklyStats || null));
    const importedActivityHistory = parseStoredActivityHistory(
      JSON.stringify(rawData?.activityHistory || {})
    );
    const importedFreeDailyUsage = ensureCurrentFreeDailyUsage(rawData?.freeDailyUsage);
    const importedProDailyGoalQuestions =
      rawData?.proDailyGoalQuestions === undefined
        ? proDailyGoalQuestions
        : parseDailyGoalTarget(rawData?.proDailyGoalQuestions);
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
    const importedLastQuizSetup =
      rawData?.lastQuizSetup && typeof rawData.lastQuizSetup === "object" && !Array.isArray(rawData.lastQuizSetup)
        ? parseStoredQuizSetup(JSON.stringify(rawData.lastQuizSetup))
        : null;

    setTheme(importedTheme);
    setBooks(importedBooks);
    setStreak(importedStreak);
    setXp(importedXp);
    setIsLevelsEnabled(importedIsLevelsEnabled);
    setIsSidebarHidden(importedSidebarHidden);
    setWeeklyStats(importedWeeklyStats);
    setActivityHistory(importedActivityHistory);
    setFreeDailyUsage(importedFreeDailyUsage);
    setProDailyGoalQuestions(importedProDailyGoalQuestions);
    setLastQuizMistakeKeys(importedLastQuizMistakeKeys);
    setLastQuizMistakeKeysByBook(importedLastQuizMistakeKeysByBook);
    setLastQuizMistakeMode(importedLastQuizMistakeMode);
    setLastQuizMistakeModeByBook(importedLastQuizMistakeModeByBook);
    setLastQuizSetup(importedLastQuizSetup);
    setCurrentBookId((prev) => (importedBooks.some((book) => book.id === prev) ? prev : importedBooks[0]?.id ?? null));
    if (screenAfterApply) setScreen(screenAfterApply);
  }

  function resetAppDataToDefaults() {
    applyAppDataSnapshot({
      theme,
      isSidebarHidden,
      proDailyGoalQuestions,
    });
    setFreeDefinitionSessionUsage(createDefaultFreeDefinitionSessionUsage());
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
        isLevelsEnabled,
        isSidebarHidden,
        weeklyStats,
        activityHistory,
        freeDailyUsage,
        proDailyGoalQuestions,
        lastQuizMistakeKeys,
        lastQuizMistakeKeysByBook,
        lastQuizMistakeMode,
        lastQuizMistakeModeByBook,
        lastQuizSetup,
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
      isChangePasswordModalOpen ||
      Boolean(accountPanelModal) ||
      isDailyGoalModalOpen ||
      Boolean(bookPendingRename) ||
      Boolean(bookPendingDelete) ||
      Boolean(chapterPendingDelete) ||
      Boolean(wordPendingDelete) ||
      Boolean(friendPendingRemove) ||
      Boolean(noticeModal);
    if (!isModalOpen) return;

    const closeModal = () => {
      if (isAddBookModalOpen) setIsAddBookModalOpen(false);
      if (isChangePasswordModalOpen) setIsChangePasswordModalOpen(false);
      if (accountPanelModal) setAccountPanelModal("");
      if (isDailyGoalModalOpen) setIsDailyGoalModalOpen(false);
      if (bookPendingRename) setBookPendingRename(null);
      if (bookPendingDelete) setBookPendingDelete(null);
      if (chapterPendingDelete) setChapterPendingDelete(null);
      if (wordPendingDelete) setWordPendingDelete(null);
      if (friendPendingRemove) setFriendPendingRemove(null);
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
  }, [
    isAddBookModalOpen,
    isChangePasswordModalOpen,
    accountPanelModal,
    isDailyGoalModalOpen,
    bookPendingRename,
    bookPendingDelete,
    chapterPendingDelete,
    wordPendingDelete,
    friendPendingRemove,
    isDeleteAccountConfirmOpen,
    noticeModal,
  ]);

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

    if (bookPendingRename) {
      return (
        <div className="modalOverlay" onClick={() => setBookPendingRename(null)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-book-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="rename-book-title">Rename Book</h3>
            <input
              value={renamedBookName}
              onChange={(e) => setRenamedBookName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmRenameBook()}
              placeholder="Enter new book name"
              autoFocus
            />
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setBookPendingRename(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="modalBtn primary"
                onClick={confirmRenameBook}
                disabled={!renamedBookName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isChangePasswordModalOpen) {
      return (
        <div className="modalOverlay" onClick={() => setIsChangePasswordModalOpen(false)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="change-password-title">Reset Password</h3>
            <p className="settingsHint">Enter the email associated with this account.</p>
            <input
              className="settingsInput"
              type="email"
              value={accountSecurityForm.resetEmail}
              onChange={(event) => {
                setAccountSecurityForm((prev) => ({ ...prev, resetEmail: event.target.value }));
                if (accountActionError) setAccountActionError("");
              }}
              placeholder="account email"
              autoComplete="email"
              autoFocus
              onKeyDown={async (event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const success = await changeAccountPassword();
                if (success) setIsChangePasswordModalOpen(false);
              }}
            />
            <div className="modalActions">
              <button
                type="button"
                className="modalBtn ghost"
                onClick={() => setIsChangePasswordModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modalBtn primary"
                disabled={isPasswordChangeSubmitting}
                onClick={async () => {
                  const success = await changeAccountPassword();
                  if (success) setIsChangePasswordModalOpen(false);
                }}
              >
                {isPasswordChangeSubmitting ? "Please wait..." : "Send Reset Email"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isDeleteAccountConfirmOpen) {
      return (
        <div className="modalOverlay" onClick={() => setIsDeleteAccountConfirmOpen(false)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-account-confirm-title">Delete Account?</h3>
            <p>
              This permanently removes your account and cloud data. This action cannot be undone.
            </p>
            <div className="modalActions">
              <button
                type="button"
                className="modalBtn ghost"
                onClick={() => setIsDeleteAccountConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modalBtn danger"
                onClick={deleteAccountPermanently}
                disabled={isDeleteAccountSubmitting}
              >
                {isDeleteAccountSubmitting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (accountPanelModal && screen === "account" && authToken) {
      const billingPeriodEndLabel = billingCurrentPeriodEnd
        ? new Date(billingCurrentPeriodEnd).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";
      const isAccountDeletionBlockedBySubscription =
        billingPlan === "pro" && !isCanceledSubscriptionStatus(billingSubscriptionStatus);

      return (
        <div className="modalOverlay" onClick={() => setAccountPanelModal("")}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-panel-title"
            onClick={(event) => event.stopPropagation()}
          >
            {accountPanelModal === "plan" ? (
              <>
                <h3 id="account-panel-title">Plan</h3>
                <p className="settingsHint">
                  Current plan:{" "}
                  <strong className="billingPlanLabel">{billingPlan === "pro" ? "Pro" : "Free"}</strong>
                </p>
                {billingSubscriptionStatus ? (
                  <p className="settingsHint">Subscription status: {billingSubscriptionStatus}</p>
                ) : null}
                {billingPeriodEndLabel ? (
                  <p className="settingsHint">Current period ends: {billingPeriodEndLabel}</p>
                ) : null}
                {!isStripeBillingConfigured ? (
                  <p className="settingsHint">
                    Stripe billing is not configured yet. Add Stripe env vars on the backend.
                  </p>
                ) : null}
                {billingPlan === "pro" ? (
                  <div className="settingsRow">
                    <span>Manage billing</span>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={openBillingPortal}
                      disabled={isBillingPortalSubmitting || !isStripeBillingConfigured}
                    >
                      {isBillingPortalSubmitting ? "Please wait..." : "Manage Subscription"}
                    </button>
                  </div>
                ) : (
                  <div className="settingsRow">
                    <span>{PREMIUM_UPGRADE_ENABLED ? "Upgrade account" : "Pro coming soon"}</span>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={startBillingCheckout}
                      disabled={
                        !PREMIUM_UPGRADE_ENABLED ||
                        isBillingCheckoutSubmitting ||
                        !isStripeBillingConfigured ||
                        isBillingStatusLoading
                      }
                    >
                      {!PREMIUM_UPGRADE_ENABLED
                        ? "Upgrade Coming Soon"
                        : isBillingCheckoutSubmitting
                          ? "Redirecting..."
                          : "Upgrade to Pro"}
                    </button>
                  </div>
                )}
                {!PREMIUM_UPGRADE_ENABLED ? (
                  <p className="settingsHint">Pro coming soon.</p>
                ) : null}
              </>
            ) : null}

            {accountPanelModal === "session" ? (
              <>
                <h3 id="account-panel-title">Session</h3>
                <p className="settingsHint">
                  Signed in as <strong>{authUsername}</strong>
                </p>
                <div className="settingsRow">
                  <span>This device</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={() => logoutAccount({ clearLocalData: true })}
                  >
                    Log Out
                  </button>
                </div>
                <div className="settingsRow">
                  <span>All devices</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={logoutAllDevices}
                    disabled={isLogoutAllSubmitting}
                  >
                    {isLogoutAllSubmitting ? "Please wait..." : "Log Out All Devices"}
                  </button>
                </div>
              </>
            ) : null}

            {accountPanelModal === "profile" ? (
              <>
                <h3 id="account-panel-title">Account Info</h3>
                <div className="settingsRow">
                  <span>Email</span>
                  <strong className="accountInfoValue">
                    {isAccountProfileLoading ? "Loading..." : accountEmail || "No email available"}
                  </strong>
                </div>
                <div className="settingsRow">
                  <span>Username</span>
                  <strong className="accountInfoValue">{authUsername || "Unknown"}</strong>
                </div>
                <div className="settingsRow accountPasswordRow">
                  <span>Password</span>
                  <div className="accountPasswordActions">
                    <strong className="accountInfoValue">{"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}</strong>
                    <button
                      type="button"
                      className="primaryBtn accountInlineBtn"
                      disabled={isPasswordChangeSubmitting || isAccountProfileLoading}
                      onClick={() => {
                        setAccountActionError("");
                        setAccountSecurityForm((prev) => ({
                          ...prev,
                          resetEmail: String(accountEmail || "").trim().toLowerCase(),
                        }));
                        setIsChangePasswordModalOpen(true);
                      }}
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {accountPanelModal === "danger" ? (
              <>
                <h3 id="account-panel-title">Danger Zone</h3>
                <p className="settingsHint">
                  Deleting your account permanently removes cloud data and cannot be undone.
                </p>
                {isAccountDeletionBlockedBySubscription ? (
                  <p className="settingsHint">
                    Cancel your Pro subscription first. You can delete your account only after status is
                    canceled.
                  </p>
                ) : null}
                <div className="settingsPasswordWrap">
                  <input
                    className="settingsInput settingsPasswordInput"
                    type={isPasswordVisible ? "text" : "password"}
                    value={accountSecurityForm.deletePassword}
                    onChange={(event) => {
                      setAccountSecurityForm((prev) => ({ ...prev, deletePassword: event.target.value }));
                      if (accountActionError) setAccountActionError("");
                    }}
                    placeholder="password to delete account"
                    autoComplete="current-password"
                    disabled={isAccountDeletionBlockedBySubscription || isBillingStatusLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="settingsPasswordToggleBtn"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    title={isPasswordVisible ? "Hide password" : "Show password"}
                    disabled={isAccountDeletionBlockedBySubscription || isBillingStatusLoading}
                  >
                    {"\uD83D\uDC41"}
                  </button>
                </div>
                <div className="settingsRow">
                  <span>Permanent action</span>
                  <button
                    type="button"
                    className="primaryBtn settingsDangerBtn"
                    onClick={askDeleteAccountConfirmation}
                    disabled={
                      isDeleteAccountSubmitting ||
                      isBillingStatusLoading ||
                      isAccountDeletionBlockedBySubscription
                    }
                  >
                    {isDeleteAccountSubmitting ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </>
            ) : null}

            {accountActionError ? <p className="settingsErrorText">{accountActionError}</p> : null}
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setAccountPanelModal("")}>
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isDailyGoalModalOpen) {
      return (
        <div className="modalOverlay" onClick={() => setIsDailyGoalModalOpen(false)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-goal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="daily-goal-title">Daily Goal</h3>
            <p className="settingsHint">
              Track today&apos;s target and jump into your highest-priority review words.
            </p>
            <div className="premiumFocusGrid">
              <div className="premiumFocusMetric">
                <span>Progress Today</span>
                <strong>{proDailyGoalProgress} / {proDailyGoalQuestions} questions</strong>
                <div className="premiumProgressTrack" aria-hidden="true">
                  <div className="premiumProgressFill" style={{ width: `${proDailyGoalPercent}%` }} />
                </div>
                <small>{hasMetProDailyGoal ? "Goal complete today." : "Complete quizzes to close the goal."}</small>
              </div>
              <div className="premiumFocusMetric">
                <span>Smart Queue</span>
                <strong>{smartReviewWords.length} words ready</strong>
                <small>Weak words prioritized by your recent performance.</small>
              </div>
            </div>
            {isProPlan ? (
              <div className="modalActions">
                <button
                  type="button"
                  className="modalBtn ghost"
                  onClick={() =>
                    setProDailyGoalQuestions((prev) =>
                      parseDailyGoalTarget(Math.max(PRO_DAILY_GOAL_MIN, prev - PRO_DAILY_GOAL_STEP))
                    )
                  }
                >
                  Goal -5
                </button>
                <button
                  type="button"
                  className="modalBtn ghost"
                  onClick={() =>
                    setProDailyGoalQuestions((prev) =>
                      parseDailyGoalTarget(Math.min(PRO_DAILY_GOAL_MAX, prev + PRO_DAILY_GOAL_STEP))
                    )
                  }
                >
                  Goal +5
                </button>
                <button
                  type="button"
                  className="modalBtn primary"
                  onClick={() => {
                    setIsDailyGoalModalOpen(false);
                    openSmartReviewSetup();
                  }}
                >
                  Open Quiz Setup
                </button>
              </div>
            ) : (
              <div className="modalActions">
                <button
                  type="button"
                  className="modalBtn primary"
                  onClick={() => setIsDailyGoalModalOpen(false)}
                >
                  Close
                </button>
              </div>
            )}
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

    if (wordPendingDelete) {
      return (
        <div className="modalOverlay" onClick={() => setWordPendingDelete(null)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-word-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-word-title">Delete Tracked Word?</h3>
            <p>
              "{wordPendingDelete.word}" is at mastery level {wordPendingDelete.level} ({wordPendingDelete.label}).
              Deleting it will remove its progress history.
            </p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setWordPendingDelete(null)}>
                Cancel
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmDeleteWord}>
                Delete Word
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (friendPendingRemove) {
      return (
        <div className="modalOverlay" onClick={() => setFriendPendingRemove(null)}>
          <div
            className="modalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-friend-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="remove-friend-title">Remove Friend</h3>
            <p>
              Remove @{friendPendingRemove.username || `user_${friendPendingRemove.userId}`} from your friends list?
            </p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setFriendPendingRemove(null)}>
                Cancel
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmRemoveFriend}>
                Remove
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
    const masteredCount = words.filter((wordEntry) => getWordMasteryMeta(wordEntry).level >= 4).length;
    const isFullyMasteredBook = words.length > 0 && masteredCount === words.length;
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
          <div className="selectBookTitleRow">
            <h3 className="selectBookTitle">
              {book.name}
            </h3>
            {isFullyMasteredBook && <span className="selectBookMasteredBadge">Mastered</span>}
            <button
              type="button"
              className="bookRenameBtn"
              aria-label={`Rename ${book.name}`}
              onClick={(e) => {
                e.stopPropagation();
                openRenameBookModal(book);
              }}
            >
              {"\u270E"}
            </button>
          </div>
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
          <div className="selectBookStat">
            <span>Mastered</span>
            <strong
              className={`selectBookMasteryCount ${masteredCount > 0 ? "isActive" : ""}`}
            >
              {masteredCount}
            </strong>
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
    const masteredCount = words.filter((wordEntry) => getWordMasteryMeta(wordEntry).level >= 4).length;
    const isFullyMasteredBook = words.length > 0 && masteredCount === words.length;
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
          <div className="selectBookTitleRow">
            <h3 className="selectBookTitle">
              {book.name}
            </h3>
            {isFullyMasteredBook && <span className="selectBookMasteredBadge">Mastered</span>}
            <button
              type="button"
              className="bookRenameBtn"
              aria-label={`Rename ${book.name}`}
              onClick={(e) => {
                e.stopPropagation();
                openRenameBookModal(book);
              }}
            >
              {"\u270E"}
            </button>
          </div>
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
          <div className="selectBookStat">
            <span>Mastered</span>
            <strong
              className={`selectBookMasteryCount ${masteredCount > 0 ? "isActive" : ""}`}
            >
              {masteredCount}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  function initializeQuizSetupSelection() {
    setQuizSetupStep(0);
    setIsQuickQuizSetupArmed(false);
    setQuizSetupSelection({
      bookIds: [],
      chapterKeys: [],
      difficultyKeys: [],
    });
  }

  function applyQuickQuizSetup() {
    if (!lastQuizSetup) {
      openNoticeModal("No previous quiz setup found yet.", "Quick Setup");
      return;
    }
    setQuizMode(normalizeQuizMode(lastQuizSetup.mode, "normal"));
    setQuizSetupSelection({
      bookIds: [...(lastQuizSetup.bookIds || [])],
      chapterKeys: [...(lastQuizSetup.chapterKeys || [])],
      difficultyKeys: [...(lastQuizSetup.difficultyKeys || [])],
    });
    setIsQuickQuizSetupArmed(true);
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
    if (!isProPlan && !isFreeDefinitionSessionActive) {
      openNoticeModal(
        currentFreeDailyUsage.definitionSessionStarts >= freeDailyDefinitionSessionLimit
          ? freeDefinitionLimitReachedMessage
          : "Start your free 10-minute add-definitions session first.",
        "Free Limit"
      );
      return;
    }

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
                  masteryXp: 0,
                  currentDefinitionIndex: 0,
                  definition: definitions[0],
                  chapterId: safeSelectedChapterIdForNewWords,
                  difficulty: estimateCefrLevel(cleanWord),
                  quizPerformanceHistory: [],
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
      updateStreak();
      setInputWord("");
    } catch {
      openNoticeModal("Failed to fetch definition.", "Network Error");
    } finally {
      setLoading(false);
    }
  }

  function startFreeDefinitionSession() {
    if (isProPlan) return;
    if (isFreeDefinitionSessionActive) return;

    const safeUsage = ensureCurrentFreeDailyUsage(freeDailyUsage);
    if (safeUsage.definitionSessionStarts >= freeDailyDefinitionSessionLimit) {
      openNoticeModal(freeDefinitionLimitReachedMessage, "Free Limit");
      return;
    }

    const now = new Date();
    setFreeDefinitionSessionUsage({
      startedAt: now.getTime(),
    });
    setFreeDailyUsage((prev) => {
      const current = ensureCurrentFreeDailyUsage(prev, now);
      return {
        ...current,
        definitionSessionStarts: current.definitionSessionStarts + 1,
      };
    });
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
    sourceChapterId = DEFAULT_CHAPTER_ID,
    options = {}
  ) {
    const shouldAwardMastery = options?.awardMastery !== false;
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
                  masteryXp: shouldAwardMastery
                    ? Math.min(getWordMasteryXp(wordEntry) + 1, WORD_MASTERY_MAX_XP)
                    : getWordMasteryXp(wordEntry),
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

  function recordQuizQuestionCompleted(payload = null) {
    const isPayloadObject = payload && typeof payload === "object" && !Array.isArray(payload);
    const sourceBookId = isPayloadObject ? payload.sourceBookId ?? null : payload;
    const sourceChapterId = isPayloadObject ? payload.sourceChapterId ?? DEFAULT_CHAPTER_ID : DEFAULT_CHAPTER_ID;
    const sourceWord = isPayloadObject ? String(payload.word || "").trim() : "";
    const sourceMode = normalizeTrackedQuizMode(isPayloadObject ? payload.mode : "");
    const isCorrect = isPayloadObject ? Boolean(payload.isCorrect) : false;
    const isMistakeReviewAttempt = isPayloadObject ? Boolean(payload.isMistakeReview) : false;
    const shouldTrackWeakWordPerformance = !(isMistakeReviewAttempt && isCorrect);

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
        book.id !== sourceBookId
          ? book
          : {
              ...book,
              questionsCompleted: Math.max(
                0,
                Math.floor(Number(book.questionsCompleted) || 0)
              ) + 1,
              words:
                sourceWord && sourceMode && shouldTrackWeakWordPerformance
                  ? (book.words || []).map((wordEntry) => {
                      const wordKey = normalizeQuizAnswer(wordEntry?.word);
                      const targetKey = normalizeQuizAnswer(sourceWord);
                      const chapterKey = String(wordEntry?.chapterId || DEFAULT_CHAPTER_ID);
                      const targetChapterKey = String(sourceChapterId || DEFAULT_CHAPTER_ID);
                      if (wordKey !== targetKey || chapterKey !== targetChapterKey) return wordEntry;

                      return {
                        ...wordEntry,
                        quizPerformanceHistory: appendWordQuizPerformance(
                          wordEntry?.quizPerformanceHistory,
                          {
                            mode: sourceMode,
                            correct: isCorrect,
                          }
                        ),
                      };
                    })
                  : book.words,
            }
      )
    );
  }

  function handleQuizComplete(summary) {
    const safeSummary = summary && typeof summary === "object" ? summary : {};
    updateStreak();
    const completedMode = normalizeQuizMode(safeSummary.mode, "normal");
    const mistakeCount = Array.isArray(safeSummary.mistakes) ? safeSummary.mistakes.length : 0;
    const questionBookCount = Array.isArray(safeSummary.questionBookIds)
      ? safeSummary.questionBookIds.length
      : 0;

    trackEvent("quiz_completed", {
      quiz_mode: completedMode,
      is_mistake_review: Boolean(safeSummary.isMistakeReview),
      mistake_count: mistakeCount,
      question_book_count: questionBookCount,
    });

    if (safeSummary.isMistakeReview) return;

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
  // ---------- DASHBOARD ----------
  if (screen === "dashboard") {
    return renderWithSidebar(
      <div className="page dashboardPage">
        <div className="dashboardHeader">
          <div className="dashboardTitleRow">
            <h1>{isProPlan ? "Vocalibry Pro" : "Vocalibry"}</h1>
          </div>
          <div className="dashboardStatus isEconomyOff">
            <div className="streakWrap">
              <div className="streakTopRow">
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
                <div className="streakBadge" aria-label="Current streak">
                  {"\uD83D\uDD25"} {streak.count} day{streak.count !== 1 && "s"}
                </div>
              </div>
            </div>
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
          {isProPlan ? (
            <>
              <div className="weeklyDailyDivider" aria-hidden="true" />
              <button
                type="button"
                className="weeklyOverviewCard dailyGoalOverviewCard"
                onClick={() => setIsDailyGoalModalOpen(true)}
              >
                <p className="weeklyOverviewLabel">Daily Goal</p>
                <strong className="weeklyOverviewValue">
                  {proDailyGoalProgress} / {proDailyGoalQuestions} questions
                </strong>
                <div className="premiumProgressTrack" aria-hidden="true">
                  <div className="premiumProgressFill" style={{ width: `${proDailyGoalPercent}%` }} />
                </div>
                <span className="settingsHint">Tap to manage your daily goal.</span>
              </button>
            </>
          ) : null}
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
                    title={book.name}
                    onClick={() => {
                      setCurrentBookId(book.id);
                      setScreen("bookMenu");
                    }}
                  >
                    <span className="recentSquareLabel">{book.name}</span>
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
            <span>{"\uD83D\uDCD8"} Definitions</span>
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
            onClick={() => setScreen("socialLeaderboard")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setScreen("socialLeaderboard");
              }
            }}
          >
            <span>{"\uD83D\uDC65"} Socials</span>
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- SETTINGS ----------
  if (screen === "settings") {
    return renderWithSidebar(
      <div className="page accountPage">
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
        <div className="analyticsSection accountSection">
          {authToken ? (
            <div className="accountLauncherGrid">
              <button
                type="button"
                className="analyticsCard settingsCard accountCard accountLauncherCard"
                onClick={() => {
                  setAccountActionError("");
                  setAccountPanelModal("plan");
                }}
              >
                <div className="accountLauncherHead">
                  <span className="accountLauncherIcon" aria-hidden="true">{"\uD83D\uDC8E"}</span>
                  <h3>Plan</h3>
                </div>
                <p className="settingsHint">
                  {billingPlan === "pro" ? "Manage subscription and billing details." : "View current billing status."}
                </p>
                <span className="accountLauncherAction">Open</span>
              </button>
              <button
                type="button"
                className="analyticsCard settingsCard accountCard accountLauncherCard"
                onClick={() => {
                  setAccountActionError("");
                  setAccountPanelModal("session");
                }}
              >
                <div className="accountLauncherHead">
                  <span className="accountLauncherIcon" aria-hidden="true">{"\uD83D\uDDA5"}</span>
                  <h3>Session</h3>
                </div>
                <p className="settingsHint">Log out this device or all devices.</p>
                <span className="accountLauncherAction">Open</span>
              </button>
              <button
                type="button"
                className="analyticsCard settingsCard accountCard accountLauncherCard"
                onClick={() => {
                  setAccountActionError("");
                  setAccountPanelModal("profile");
                }}
              >
                <div className="accountLauncherHead">
                  <span className="accountLauncherIcon" aria-hidden="true">{"\uD83D\uDC64"}</span>
                  <h3>Account Info</h3>
                </div>
                <p className="settingsHint">View email, username, and password settings.</p>
                <span className="accountLauncherAction">Open</span>
              </button>
              <button
                type="button"
                className="analyticsCard settingsCard accountCard accountLauncherCard accountDangerCard"
                onClick={() => {
                  setAccountActionError("");
                  setAccountPanelModal("danger");
                }}
              >
                <div className="accountLauncherHead">
                  <span className="accountLauncherIcon" aria-hidden="true">{"\u26A0"}</span>
                  <h3>Danger Zone</h3>
                </div>
                <p className="settingsHint">Delete your account permanently.</p>
                <span className="accountLauncherAction">Open</span>
              </button>
            </div>
          ) : (
            <div className="accountAuthWrap">
              <div className="analyticsCard settingsCard accountCard">
                <h3>Account</h3>
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
                  {authMode === "register" ? (
                    <input
                      className="settingsInput"
                      type="email"
                      value={authForm.email}
                      onChange={(event) => {
                        setAuthForm((prev) => ({ ...prev, email: event.target.value }));
                        if (authError) setAuthError("");
                      }}
                      placeholder="email"
                      autoComplete="email"
                    />
                  ) : null}
                  <input
                    className="settingsInput"
                    value={authForm.username}
                    onChange={(event) => {
                      setAuthForm((prev) => ({ ...prev, username: event.target.value }));
                      if (authError) setAuthError("");
                    }}
                    placeholder={
                      authMode === "login" ? "username or email" : "username (a-z, 0-9, _)"
                    }
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
                  {authMode === "register" ? (
                    <>
                      <label className="settingsCheckRow">
                        <input
                          type="checkbox"
                          checked={Boolean(authForm.acceptedLegal)}
                          onChange={(event) => {
                            setAuthForm((prev) => ({ ...prev, acceptedLegal: event.target.checked }));
                            if (authError) setAuthError("");
                          }}
                        />
                        <span>
                          I accept the <a href="/terms">Terms &amp; Conditions</a>,{" "}
                          <a href="/privacy">Privacy Policy</a>, and{" "}
                          <a href="/disclaimer">Disclaimer</a>
                        </span>
                      </label>
                      <label className="settingsCheckRow">
                        <input
                          type="checkbox"
                          checked={Boolean(authForm.marketingOptIn)}
                          onChange={(event) => {
                            setAuthForm((prev) => ({ ...prev, marketingOptIn: event.target.checked }));
                            if (authError) setAuthError("");
                          }}
                        />
                        <span>
                          Send me product updates, new feature announcements, and learning tips
                        </span>
                      </label>
                    </>
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
              </div>
            </div>
          )}
          {authToken && accountActionError ? <p className="settingsErrorText">{accountActionError}</p> : null}
        </div>
        {renderModal()}
      </div>
    );
  }

  // ---------- SOCIAL ----------
  if (screen === "socialLeaderboard") {
    const currentUserProfile = socialOverview?.currentUser || null;
    const friendProfiles = Array.isArray(socialOverview?.friends) ? socialOverview.friends : [];
    const strictLeaderboardProfiles = Array.isArray(socialOverview?.leaderboardProfiles)
      ? socialOverview.leaderboardProfiles
      : [];
    const ownLeagueTrack = (currentUserProfile?.plan || billingPlan) === "pro" ? "pro" : "free";
    const leagueTrack = ownLeagueTrack;
    const leagueLabel = leagueTrack === "pro" ? "Pro League" : "Free League";
    const rankedProfiles = (strictLeaderboardProfiles.length > 0
      ? strictLeaderboardProfiles
      : [currentUserProfile, ...friendProfiles])
      .filter(Boolean)
      .filter((profile) => ((profile?.plan || "free") === "pro" ? "pro" : "free") === leagueTrack);
    const timeframeKey = socialTimeframe === "monthly"
      ? "monthly"
      : socialTimeframe === "yearly"
        ? "yearly"
        : socialTimeframe === "total"
          ? "total"
          : "weekly";
    const timeframeLabel = timeframeKey === "monthly"
      ? "Monthly"
      : timeframeKey === "yearly"
        ? "Yearly"
        : timeframeKey === "total"
          ? "Total"
          : "Weekly";
    const timeframeOptions = [
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" },
      { value: "total", label: "Total" },
    ];
    const metricKey = socialMetric === "questionsCompleted"
      ? "questionsCompleted"
      : socialMetric === "timeSpentSeconds"
        ? "timeSpentSeconds"
        : "wordsAdded";
    const metricLabel = metricKey === "questionsCompleted"
      ? "Questions"
      : metricKey === "timeSpentSeconds"
        ? "Time Spent"
        : "Words Added";
    const leaderboardRows = rankedProfiles
      .map((profile) => ({
        userId: profile.userId,
        username: profile.username,
        isMe: profile.userId === currentUserProfile?.userId,
        ...getProfileStatsForPeriod(profile, timeframeKey),
      }))
      .sort((a, b) => {
        if (b[metricKey] !== a[metricKey]) return b[metricKey] - a[metricKey];
        return a.username.localeCompare(b.username);
      });
    const topScore = leaderboardRows.length > 0 ? Math.max(1, leaderboardRows[0][metricKey]) : 1;
    const myRankIndex = leaderboardRows.findIndex((row) => row.isMe);
    const myRow = myRankIndex >= 0 ? leaderboardRows[myRankIndex] : null;
    const rivalRow = myRankIndex > 0 ? leaderboardRows[myRankIndex - 1] : null;
    const rivalGap = rivalRow && myRow ? Math.max(0, rivalRow[metricKey] - myRow[metricKey]) : 0;
    const podiumRows = leaderboardRows.slice(0, 3);
    const podiumSlots = [podiumRows[1], podiumRows[0], podiumRows[2]];

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>Leaderboard</h1>
        </div>
        {!authToken ? (
          <p>Please log in from My Account to use leaderboard features.</p>
        ) : (
          <div className="analyticsSection socialSectionStack">
            {!isProPlan ? (
              <div className="analyticsCard">
                <h3>Friend Bonus</h3>
                <p className="settingsHint">
                  Get {FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_LIMIT} daily 10-minute definition sessions when you have{" "}
                  {FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD}+ friends.
                </p>
                <p className="settingsHint">
                  Progress: {Math.min(friendProfiles.length, FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD)}/
                  {FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD} friends
                  {friendProfiles.length >= FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD
                    ? " (Unlocked)"
                    : ""}
                </p>
              </div>
            ) : null}
            <div className="analyticsCard">
              <div className="settingsRow">
                <span>Manage friends and requests</span>
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={() => setScreen("socialFriends")}
                >
                  Go To Friends
                </button>
              </div>
            </div>
            <div className="analyticsCard socialLeaderboardCard">
              <h3>Leaderboard</h3>
              <p className="settingsHint">
                Climb the ranks in your plan league.
              </p>
              <p className="settingsHint">League: {leagueLabel}</p>
              <div className="socialMetricRow">
                <span className="socialTimeframeLabel">
                  Timeframe
                </span>
                <InAppDropdown
                  className="socialTimeframeDropdown"
                  value={timeframeKey}
                  options={timeframeOptions}
                  onChange={(nextValue) => setSocialTimeframe(nextValue)}
                />
              </div>
              <div className="socialMetricRow">
                <button
                  type="button"
                  className={`settingsAuthModeBtn ${socialMetric === "wordsAdded" ? "isActive" : ""}`}
                  onClick={() => setSocialMetric("wordsAdded")}
                >
                  Words Added
                </button>
                <button
                  type="button"
                  className={`settingsAuthModeBtn ${socialMetric === "questionsCompleted" ? "isActive" : ""}`}
                  onClick={() => setSocialMetric("questionsCompleted")}
                >
                  Questions
                </button>
                <button
                  type="button"
                  className={`settingsAuthModeBtn ${socialMetric === "timeSpentSeconds" ? "isActive" : ""}`}
                  onClick={() => setSocialMetric("timeSpentSeconds")}
                >
                  Time Spent
                </button>
              </div>
              {myRow ? (
                <div className="socialRivalCard">
                  {myRankIndex === 0 ? (
                    <p>
                      {"\uD83C\uDFC6"} You are rank #1 in {timeframeLabel.toLowerCase()} {metricLabel.toLowerCase()}. Keep pushing to stay on top.
                    </p>
                  ) : (
                    <p>
                      {"\u26A1"} You are #{myRankIndex + 1}. You need{" "}
                      <strong>
                        {metricKey === "timeSpentSeconds" ? formatWeeklyTime(rivalGap) : rivalGap}
                      </strong>{" "}
                      more {timeframeLabel.toLowerCase()} {metricLabel.toLowerCase()} to pass @{rivalRow?.username}.
                    </p>
                  )}
                </div>
              ) : null}
              {leaderboardRows.length === 0 ? (
                <p className="settingsHint">No leaderboard data yet.</p>
              ) : (
                <>
                  <div className="socialPodium">
                    {podiumSlots.map((row, index) => {
                      if (!row) return <div key={`podium-empty-${index}`} className="socialPodiumCard isEmpty" />;
                      const isFirst = index === 1;
                      const rank = isFirst ? 1 : index === 0 ? 2 : 3;
                      const rankEmoji = rank === 1 ? "\uD83E\uDD47" : rank === 2 ? "\uD83E\uDD48" : "\uD83E\uDD49";
                      const scoreDisplay = metricKey === "timeSpentSeconds"
                        ? formatWeeklyTime(row[metricKey])
                        : row[metricKey];
                      return (
                        <div
                          key={row.userId}
                          className={`socialPodiumCard rank${rank} ${row.isMe ? "isMe" : ""}`}
                        >
                          <span className="socialPodiumMedal">{rankEmoji}</span>
                          <strong>@{row.username}</strong>
                          <span className="socialPodiumValue">{scoreDisplay}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="socialLeaderboard">
                    {leaderboardRows.map((row, index) => {
                      const score = row[metricKey];
                      const scoreDisplay = metricKey === "timeSpentSeconds" ? formatWeeklyTime(score) : score;
                      const barWidth = Math.round((Math.max(score, 0) / topScore) * 100);
                      return (
                        <div key={row.userId} className={`socialLeaderboardRow ${row.isMe ? "isMe" : ""}`}>
                          <span className="socialLeaderboardRank">#{index + 1}</span>
                          <div className="socialLeaderboardIdentity">
                            <div className="socialLeaderboardNameRow">
                              <strong>@{row.username}</strong>
                              {index === 0 ? <span className="socialLeaderBadge">Leader</span> : null}
                            </div>
                            <div className="socialLeaderboardBarTrack" aria-hidden="true">
                              <div className="socialLeaderboardBarFill" style={{ width: `${barWidth}%` }} />
                            </div>
                          </div>
                          <span className="socialLeaderboardValue">{scoreDisplay}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {isSocialLoading ? <p className="settingsHint">Loading social data...</p> : null}
            {socialError ? <p className="settingsErrorText">{socialError}</p> : null}
          </div>
        )}
        {renderModal()}
      </div>
    );
  }

  if (screen === "socialFriends") {
    const friendProfiles = Array.isArray(socialOverview?.friends) ? socialOverview.friends : [];
    const incomingRequests = Array.isArray(socialOverview?.incomingRequests)
      ? socialOverview.incomingRequests
      : [];
    const outgoingRequests = Array.isArray(socialOverview?.outgoingRequests)
      ? socialOverview.outgoingRequests
      : [];

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("socialLeaderboard")}>&times;</button>
          <h1>Manage Friends</h1>
        </div>
        {!authToken ? (
          <p>Please log in from My Account to manage friends.</p>
        ) : (
          <div className="analyticsSection socialSectionStack">
            {!isProPlan ? (
              <div className="analyticsCard">
                <h3>Friend Bonus</h3>
                <p className="settingsHint">
                  Reach {FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD}+ friends to unlock{" "}
                  {FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_LIMIT} daily 10-minute definition sessions.
                </p>
                <p className="settingsHint">
                  Progress: {Math.min(friendProfiles.length, FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD)}/
                  {FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD} friends
                  {friendProfiles.length >= FREE_DAILY_DEFINITION_SESSION_FRIEND_BONUS_THRESHOLD
                    ? " (Unlocked)"
                    : ""}
                </p>
              </div>
            ) : null}
            <div className="analyticsGrid">
              <div className="analyticsCard settingsCard">
                <h3>Add Friend</h3>
                <p className="settingsHint">Search by username, then send a friend request.</p>
                <input
                  className="settingsInput"
                  value={friendUsernameInput}
                  onChange={(event) => {
                    setFriendUsernameInput(event.target.value);
                    if (socialError) setSocialError("");
                  }}
                  placeholder="friend username"
                  autoComplete="off"
                />
                <div className="settingsRow">
                  <span>Send request</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={sendFriendRequest}
                    disabled={socialActionLoadingKey === "send-request"}
                  >
                    {socialActionLoadingKey === "send-request" ? "Sending..." : "Add Friend"}
                  </button>
                </div>
              </div>

              <div className="analyticsCard">
                <h3>Incoming Requests</h3>
                {incomingRequests.length === 0 ? (
                  <p className="settingsHint">No incoming requests.</p>
                ) : (
                  <div className="socialList">
                    {incomingRequests.map((request) => (
                      <div key={request.requestId} className="socialListRow">
                        <div>
                          <strong>@{request.username}</strong>
                        </div>
                        <div className="socialRowActions">
                          <button
                            type="button"
                            className="primaryBtn"
                            onClick={() => respondToFriendRequest(request.requestId, "accept")}
                            disabled={socialActionLoadingKey === `respond-${request.requestId}-accept`}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="primaryBtn ghostBtn"
                            onClick={() => respondToFriendRequest(request.requestId, "decline")}
                            disabled={socialActionLoadingKey === `respond-${request.requestId}-decline`}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="analyticsCard">
              <h3>Friends</h3>
              {friendProfiles.length === 0 ? (
                <p className="settingsHint">Add friends to start competing.</p>
              ) : (
                <div className="socialList">
                  {friendProfiles.map((friend) => {
                    const friendStreak = Math.max(
                      0,
                      Math.floor(Number(friend?.stats?.streakCount) || 0)
                    );
                    return (
                      <div key={friend.userId} className="socialListRow">
                        <div>
                          <div className="socialFriendHeaderRow">
                            <strong className="socialFriendName">@{friend.username}</strong>
                            <div className="socialFriendBadgeRow socialFriendBadgeRowInline">
                              <span className="socialFriendBadge streak">
                                {"\uD83D\uDD25"} {friendStreak}-day streak
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="primaryBtn ghostBtn"
                          onClick={() => askRemoveFriend(friend)}
                          disabled={socialActionLoadingKey === `remove-${friend.userId}`}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="socialOutgoing">
                <h3>Outgoing Requests</h3>
                {outgoingRequests.length === 0 ? (
                  <p className="settingsHint">No outgoing requests.</p>
                ) : (
                  <div className="socialList">
                    {outgoingRequests.map((request) => (
                      <div key={request.requestId} className="socialListRow">
                        <div>
                          <strong>@{request.username}</strong>
                        </div>
                        <button
                          type="button"
                          className="primaryBtn ghostBtn"
                          onClick={() => cancelOutgoingFriendRequest(request.requestId)}
                          disabled={socialActionLoadingKey === `cancel-request-${request.requestId}`}
                        >
                          Cancel Request
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isSocialLoading ? <p className="settingsHint">Loading social data...</p> : null}
            {socialError ? <p className="settingsErrorText">{socialError}</p> : null}
          </div>
        )}
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

          {isProPlan ? (
            <div className="analyticsCard premiumDataCard">
              <div className="premiumFocusHeader">
                <h3>Weak-Words Lab</h3>
              </div>
              <p className="settingsHint">
                Find the exact words that cost you points and export them for focused drills.
              </p>
              <p className="quizSetupHint">
                Rolling window: last {WEAK_WORDS_RECENT_DAY_WINDOW} days and up to{" "}
                {WEAK_WORDS_RECENT_QUESTION_WINDOW} recent answers per word.
              </p>
              <div className="premiumWeakList">
                {weakWordCandidates.slice(0, 8).map((entry, index) => (
                  <div key={`${entry.sourceBookId}:${entry.word}:${index}`} className="premiumWeakRow">
                    <strong>{entry.word}</strong>
                    <span>{entry.sourceBookName}</span>
                    <span>
                      Recent:{" "}
                      {entry.recentAccuracyPercent === null || entry.recentAccuracyPercent === undefined
                        ? "N/A"
                        : `${entry.recentAccuracyPercent}%`}{" "}
                      ({entry.recentAttempts})
                    </span>
                    <span>
                      MC:{" "}
                      {entry.recentNormalAccuracyPercent === null || entry.recentNormalAccuracyPercent === undefined
                        ? "N/A"
                        : `${entry.recentNormalAccuracyPercent}%`}{" "}
                      | Typing:{" "}
                      {entry.recentTypingAccuracyPercent === null || entry.recentTypingAccuracyPercent === undefined
                        ? "N/A"
                        : `${entry.recentTypingAccuracyPercent}%`}
                    </span>
                  </div>
                ))}
                {weakWordCandidates.length === 0 ? (
                  <p className="quizSetupHint">No weak-word data yet. Complete quizzes to build insights.</p>
                ) : null}
              </div>
              <div className="premiumActionRow">
                <button type="button" className="primaryBtn" onClick={openSmartReviewSetup}>
                  Open Quiz Setup
                </button>
                <button type="button" className="primaryBtn" onClick={exportWeakWordsCsv}>
                  Export Weak Words CSV
                </button>
              </div>
            </div>
          ) : null}

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
      <div className="page bookMenuPage">
        <div className="pageHeader">
          <button className="backBtn" aria-label="Go back" onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{currentBook?.name}</h1>
        </div>
        <div className="panelGrid bookModeGrid">
          <div
            className="panelCard bookModeCard"
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
            <span className="bookModeIcon" aria-hidden="true">{"\uD83D\uDCD8"}</span>
            <strong>Definitions</strong>
            <p>Add and manage words, meanings, and chapter placement.</p>
          </div>

          <div
            className="panelCard bookModeCard"
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
            <span className="bookModeIcon" aria-hidden="true">{"\u26A1"}</span>
            <strong>Flashcards</strong>
            <p>Drill recall quickly with focused review sessions.</p>
          </div>
          <div
            className="panelCard bookModeCard"
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
            <span className="bookModeIcon" aria-hidden="true">{"\u2705"}</span>
            <strong>Quiz</strong>
            <p>Test active recall with normal, typing, or mistake mode.</p>
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
        {sortedBooksByRecent.length === 0 ? (
          <p className="quizSetupHint">No books found. Create a new book in the My Books tab first.</p>
        ) : (
          <div className="bookGrid selectBookGrid">
            {sortedBooksByRecent.map((book) =>
              renderSelectBookCard(book, () => {
                openBookFromSelect(book.id, "definitions");
              })
            )}
          </div>
        )}
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
          <button type="button" className="addWordBtn" onClick={addWord}>+</button>
          {!isProPlan ? (
            <button
              type="button"
              className="primaryBtn definitionSessionInlineBtn"
              onClick={startFreeDefinitionSession}
              disabled={
                isFreeDefinitionSessionActive ||
                currentFreeDailyUsage.definitionSessionStarts >= freeDailyDefinitionSessionLimit
              }
            >
              {isFreeDefinitionSessionActive
                ? formatCountdown(freeDefinitionSessionDisplayMs)
                : `Start 10-Min Session (${freeDefinitionSessionsUsedToday}/${freeDailyDefinitionSessionLimit})`}
            </button>
          ) : null}
          {!isProPlan ? (
            <span className="definitionSessionInlineHint">
              {hasFriendDefinitionSessionBonus
                ? `Friend Bonus active: ${freeDefinitionSessionsUsedToday}/${freeDailyDefinitionSessionLimit} sessions used today.`
                : "Unlock a second session by adding 3 friends."}
            </span>
          ) : null}
        </div>
        <p className="definitionAttributionNote">
          Definition data is fetched via Free Dictionary API (dictionaryapi.dev). Upstream source URLs and
          license details are provided by that API response.
        </p>
        <div className="chapterControlsRow">
          <div className="chapterControlField">
            <span>Auto-Assign Chapters</span>
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
            const definitionVariants = getWordDefinitions(w);
            const masteryMeta = getWordMasteryMeta(w);
            const totalDefinitionVariants = definitionVariants.length;
            const currentDefinitionVariant = Math.min(
              Math.max((w.currentDefinitionIndex ?? 0) + 1, 1),
              Math.max(totalDefinitionVariants, 1)
            );

            return (
              <div key={i} className="wordRow">
                <button className="deleteBtn" onClick={() => askDeleteWord(w, i)}>x</button>
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
                      <span
                        className={`wordMasteryBlocks ${masteryMeta.level === 4 ? "isMastered" : ""}`}
                        aria-hidden="true"
                      >
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
        {sortedBooksByRecent.length === 0 ? (
          <p className="quizSetupHint">No books found. Create a new book in the My Books tab first.</p>
        ) : (
          <div className="bookGrid selectBookGrid">
            {sortedBooksByRecent.map((book) =>
              renderSelectBookCard(book, () => {
                openBookFromSelect(book.id, "flashcards");
              })
            )}
          </div>
        )}
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
    const freeTypingRemaining = Math.max(
      0,
      FREE_DAILY_TYPING_LIMIT - currentFreeDailyUsage.typingAttempts
    );
    const freeMistakeRemaining = Math.max(
      0,
      FREE_DAILY_MISTAKE_REVIEW_LIMIT - currentFreeDailyUsage.mistakeReviewAttempts
    );
    const isTypingLimitReached = !isProPlan && freeTypingRemaining <= 0;
    const isMistakeLimitReached = !isProPlan && freeMistakeRemaining <= 0;
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
    const includesTypeStep = true;
    const typeStepIndex = includesTypeStep ? 0 : -1;
    const booksStepIndex = includesTypeStep ? 1 : 0;
    const chaptersStepIndex = includesTypeStep ? 2 : 1;
    const levelsStepIndex = includesTypeStep ? 3 : 2;
    const reviewStepIndex = includesTypeStep ? 4 : 3;
    const stepTitles = includesTypeStep
      ? ["Quiz Type", "Books", "Chapters", "Levels", "Review"]
      : ["Books", "Chapters", "Levels", "Review"];
    const isAtTypeStep = quizSetupStep === typeStepIndex;
    const isAtBooksStep = quizSetupStep === booksStepIndex;
    const isAtChaptersStep = quizSetupStep === chaptersStepIndex;
    const isAtLevelsStep = quizSetupStep === levelsStepIndex;
    const isAtReviewStep = quizSetupStep === reviewStepIndex;
    const canMoveForward =
      (isAtTypeStep && includesTypeStep) ||
      (isAtBooksStep && selectedBookCount > 0) ||
      (isAtChaptersStep && selectedChapterCount > 0) ||
      (isAtLevelsStep && selectedDifficultyCount > 0);
    const nextStepHint =
      isAtBooksStep && selectedBookCount === 0
        ? "Select at least one book to continue."
        : isAtChaptersStep && selectedChapterCount === 0
          ? "Select at least one chapter to continue."
          : isAtLevelsStep && selectedDifficultyCount === 0
            ? "Select at least one level to continue."
            : "";

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
          Build your quiz in simple steps.
        </p>
        <div className="quizSetupStepRow" aria-label="Quiz setup steps">
          {stepTitles.map((label, index) => {
            const isActive = index === quizSetupStep;
            const isComplete = index < quizSetupStep;
            return (
              <button
                key={label}
                type="button"
                className={`quizSetupStepChip ${isActive ? "isActive" : ""} ${isComplete ? "isComplete" : ""}`}
                onClick={() => setQuizSetupStep(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            );
          })}
        </div>
        {isAtTypeStep && (
          <div className="chapterControlField quizChapterField">
            <div className="quizSetupFieldHeader">
              <span>Step 1. Quiz Type</span>
              <div className="quizSetupQuickActions">
                <button
                  type="button"
                  className={`quizSetupActionBtn ${isQuickQuizSetupArmed ? "isActive" : ""}`}
                  onClick={applyQuickQuizSetup}
                  disabled={!lastQuizSetup}
                >
                  {lastQuizSetup ? "Quick Setup" : "No Last Setup"}
                </button>
              </div>
            </div>
            <div className="quizModeCardGrid" role="group" aria-label="Select quiz type">
              <button
                type="button"
                className={`quizModeCard ${quizMode === "normal" ? "isActive" : ""}`}
                onClick={() => setQuizMode("normal")}
              >
                <span className="quizModeCardIcon" aria-hidden="true">{"\uD83C\uDFAF"}</span>
                <strong>Multiple Choice</strong>
                <small>
                  Pick the correct answer from options.
                  <br />
                  Strengthens: comprehension, quick recognition, and definition recall.
                </small>
              </button>
              <button
                type="button"
                className={`quizModeCard ${quizMode === "typing" ? "isActive" : ""}`}
                onClick={() => setQuizMode("typing")}
                disabled={isTypingLimitReached}
              >
                {!isProPlan ? (
                  <span className="quizLimitBadge">{freeTypingRemaining} left</span>
                ) : null}
                <span className="quizModeCardIcon" aria-hidden="true">{"\u2328"}</span>
                <strong>Typing</strong>
                <small>
                  Type the exact target word.
                  <br />
                  Strengthens: spelling precision, active recall, and improved essay writing.
                </small>
              </button>
              <button
                type="button"
                className={`quizModeCard ${quizMode === "mistake" ? "isActive" : ""}`}
                onClick={() => setQuizMode("mistake")}
                disabled={isMistakeLimitReached}
              >
                {!isProPlan ? (
                  <span className="quizLimitBadge">{freeMistakeRemaining} left</span>
                ) : null}
                <span className="quizModeCardIcon" aria-hidden="true">{"\uD83D\uDD01"}</span>
                <strong>Mistake Review</strong>
                <small>Practice only words you previously got wrong.</small>
              </button>
              <button
                type="button"
                className={`quizModeCard ${quizMode === "smart" ? "isActive" : ""}`}
                onClick={() => setQuizMode("smart")}
                disabled={!isProPlan}
              >
                {!isProPlan ? (
                  <span className="quizLimitBadge">Pro</span>
                ) : null}
                <span className="quizModeCardIcon" aria-hidden="true">{"\uD83E\uDDE0"}</span>
                <strong>Smart Review</strong>
                <small>
                  Auto-build a focused quiz from weak words based on your recent accuracy.
                </small>
              </button>
            </div>
          </div>
        )}
        {isAtBooksStep && (
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{includesTypeStep ? "Step 2. Books" : "Step 1. Books"}</span>
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
                className={`quizSetupPill quizSetupPillLarge ${selectedBookIdsSet.has(String(book.id)) ? "isActive" : ""}`}
                onClick={() => toggleQuizSetupBook(book.id)}
                title={book.name}
              >
                <span aria-hidden="true">{"\uD83D\uDCDA"}</span>
                <span className="quizSetupPillLabel">{book.name}</span>
              </button>
            ))}
          </div>
          {books.length === 0 && <p className="quizSetupHint">No books available yet.</p>}
          {selectedBookCount === 0 && (
            <p className="quizSetupHint">Select at least one book to see chapters.</p>
          )}
        </div>
        )}
        {isAtChaptersStep && (
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{includesTypeStep ? "Step 3. Chapters" : "Step 2. Chapters"}</span>
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
                      className={`quizSetupPill ${selectedChapterKeysSet.has(chapter.key) ? "isActive" : ""}`}
                      onClick={() => toggleQuizSetupChapter(chapter.key)}
                    >
                      <span aria-hidden="true">{"\uD83D\uDCC4"}</span>
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
        )}
        {isAtLevelsStep && (
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{includesTypeStep ? "Step 4. Levels" : "Step 3. Levels"}</span>
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
              className={`quizSetupPill ${selectedDifficultyKeysSet.has("unassigned") ? "isActive" : ""}`}
              onClick={() => toggleQuizSetupDifficulty("unassigned")}
            >
              <span aria-hidden="true">{"\u2753"}</span>
              Unassigned
            </button>
            {WORD_DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`quizSetupPill ${selectedDifficultyKeysSet.has(option.value) ? "isActive" : ""}`}
                onClick={() => toggleQuizSetupDifficulty(option.value)}
              >
                <span aria-hidden="true">{"\uD83D\uDCD8"}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        )}
        {isAtReviewStep && (
          <div className="quizSetupReviewCard">
            <h3>Review & Start</h3>
            <div className="quizSetupSummary">
              <span>Mode: {quizMode === "typing" ? "Typing" : quizMode === "mistake" ? "Mistake Review" : quizMode === "smart" ? "Smart Review" : "Multiple Choice"}</span>
              <span>Books: {selectedBookCount}</span>
              <span>Chapters: {selectedChapterCount}</span>
              <span>Levels: {selectedDifficultyCount}</span>
              <span>Matching words: {quizSetupWords.length}</span>
            </div>
          </div>
        )}
        {quizMode === "mistake" && !hasPreviousQuizMistakes && (
          <p className="quizSetupHint">
            No previous quiz mistakes found yet. Complete a regular quiz first.
          </p>
        )}
        {!canStartQuiz && isAtReviewStep && (
          <p className="quizSetupHint">
            Select at least one book, chapter, and difficulty with at least 2 matching words.
          </p>
        )}
        {nextStepHint ? <p className="quizSetupHint">{nextStepHint}</p> : null}
        <div className="quizFooter quizSetupFooter">
          <div className="quizSetupPager">
            <button
              type="button"
              className="primaryBtn"
              onClick={() => setQuizSetupStep((prev) => Math.max(0, prev - 1))}
              disabled={quizSetupStep === 0}
            >
              Back
            </button>
            {isAtReviewStep ? (
              <button
                type="button"
                className="primaryBtn"
                disabled={!canStartQuiz}
                onClick={startQuizSession}
              >
                Start {quizMode === "typing" ? "Typing Quiz" : quizMode === "mistake" ? "Mistake Review" : quizMode === "smart" ? "Smart Review" : "Quiz"}
              </button>
            ) : (
              <button
                type="button"
                className="primaryBtn"
                disabled={!canMoveForward}
                onClick={() => {
                  if (isAtTypeStep && quizMode === "mistake") {
                    requestMistakeReview(quizBackScreen === "bookMenu" ? "book" : "global");
                    return;
                  }
                  if (isAtTypeStep && quizMode === "smart") {
                    startSmartReviewSession();
                    return;
                  }
                  if (isAtTypeStep && isQuickQuizSetupArmed) {
                    if (canStartQuiz) {
                      startQuizSession();
                      return;
                    }
                    setIsQuickQuizSetupArmed(false);
                    openNoticeModal(
                      "Your last quiz setup no longer matches available books/chapters. Please update setup and try again.",
                      "Quick Setup Unavailable"
                    );
                    return;
                  }
                  setQuizSetupStep((prev) => Math.min(reviewStepIndex, prev + 1));
                }}
              >
                Next
              </button>
            )}
          </div>
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
        goBack={() => {
          const shouldBypassQuizSelect =
            quizBackScreen === "quizSelect" &&
            (activeQuizIsMistakeReview || activeQuizMode === "mistake");
          setScreen(shouldBypassQuizSelect ? "dashboard" : quizBackScreen);
        }}
        mode={activeQuizMode}
        isMistakeReview={activeQuizIsMistakeReview}
        onAwardXp={awardXp}
        onQuestionCompleted={recordQuizQuestionCompleted}
        onRecordMistake={recordMistakeForWord}
        onResolveMistake={resolveMistakeForWord}
        onQuizComplete={handleQuizComplete}
        onStartMistakeReview={() => requestMistakeReview(quizBackScreen === "bookMenu" ? "book" : "global")}
        buildQuizQuestions={buildQuizQuestions}
        isEquivalentTypingAnswer={isEquivalentTypingAnswer}
        XP_GAIN_PER_QUIZ_CORRECT={XP_GAIN_PER_QUIZ_CORRECT}
        DEFAULT_CHAPTER_ID={DEFAULT_CHAPTER_ID}
        QUIZ_SUCCESS_PROMPTS={QUIZ_SUCCESS_PROMPTS}
        QUIZ_MISS_PROMPTS={QUIZ_MISS_PROMPTS}
      />
    );
  }

  // ---------- MISTAKE REVIEW ----------
  if (screen === "mistakeReview") {
    return renderWithSidebar(
      <Quiz
        words={activeQuizWords}
        title={activeQuizTitle}
        goBack={() => setScreen(quizBackScreen === "quizSelect" ? "dashboard" : quizBackScreen)}
        mode={activeQuizMode}
        isMistakeReview={activeQuizIsMistakeReview}
        onAwardXp={awardXp}
        onQuestionCompleted={recordQuizQuestionCompleted}
        onRecordMistake={recordMistakeForWord}
        onResolveMistake={resolveMistakeForWord}
        onQuizComplete={handleQuizComplete}
        onStartMistakeReview={() => requestMistakeReview(quizBackScreen === "bookMenu" ? "book" : "global")}
        buildQuizQuestions={buildQuizQuestions}
        isEquivalentTypingAnswer={isEquivalentTypingAnswer}
        XP_GAIN_PER_QUIZ_CORRECT={XP_GAIN_PER_QUIZ_CORRECT}
        DEFAULT_CHAPTER_ID={DEFAULT_CHAPTER_ID}
        QUIZ_SUCCESS_PROMPTS={QUIZ_SUCCESS_PROMPTS}
        QUIZ_MISS_PROMPTS={QUIZ_MISS_PROMPTS}
      />
    );
  }

  return null;
}




