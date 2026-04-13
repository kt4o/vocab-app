import { useState, useEffect, useRef, useCallback } from "react";
import { CEFR_WORDLIST } from "./data/cefrWordlist";
import { Flashcards } from "./components/Flashcards";
import { Quiz } from "./components/Quiz";
import { PREMIUM_UPGRADE_ENABLED } from "./config/premium";
import { identifyAnalyticsUser, resetAnalyticsIdentity, trackEvent } from "./lib/analytics.js";
import { useThemeMode } from "./hooks/useThemeMode.js";

const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000;
const PRO_DAILY_GOAL_DEFAULT = 30;
const PRO_DAILY_GOAL_MIN = 10;
const PRO_DAILY_GOAL_MAX = 120;
const PRO_DAILY_GOAL_STEP = 5;
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
const TRANSLATION_API_PATH = `${API_BASE_URL}/api/translate`;
const DEFINITION_API_PATH = `${API_BASE_URL}/api/define`;
const CLOUD_STATE_SYNC_DEBOUNCE_MS = 900;
const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";
const AUTH_USERNAME_STORAGE_KEY = "vocab_auth_username";
const JAPANESE_LEARNER_MODE_STORAGE_KEY = "vocab_japanese_learner_mode";
const UI_LANGUAGE_STORAGE_KEY = "vocab_ui_language";
const DICTIONARY_PREFERENCE_STORAGE_KEY = "vocab_dictionary_preference";
const COOKIE_SESSION_AUTH_MARKER = "__cookie_session__";
const LEGAL_VERSION = "2026-04-08";
const RETENTION_PING_DAY_KEY_STORAGE = "vocab_retention_ping_day";
const ACCOUNT_DATA_STORAGE_KEYS = [
  "vocab_books",
  "vocab_weekly_stats",
  "vocab_activity_history",
  "vocab_pro_daily_goal_questions",
  "vocab_free_daily_usage",
  "vocab_last_quiz_mistakes",
  "vocab_last_quiz_mistakes_by_book",
  "vocab_last_quiz_mistake_mode",
  "vocab_last_quiz_mistake_mode_by_book",
  "vocab_last_quiz_setup",
  "vocab_streak",
  UI_LANGUAGE_STORAGE_KEY,
  DICTIONARY_PREFERENCE_STORAGE_KEY,
  JAPANESE_LEARNER_MODE_STORAGE_KEY,
  AUTH_USERNAME_STORAGE_KEY,
  RETENTION_PING_DAY_KEY_STORAGE,
];
const APP_TEXT = {
  en: {
    navDashboard: "Dashboard",
    navMyBooks: "My Books",
    navData: "Data",
    navDefinitions: "Definitions",
    navFlashcards: "Flashcards",
    navQuiz: "Quiz",
    navSocials: "Socials",
    recentBooks: "Recent Books",
    noBooksYet: "No books yet",
    settings: "Settings",
    myAccount: "My Account",
    syncingAccount: "Syncing Account",
    loadingAccountData: "Loading your account data",
    syncingSession: "Your books, progress, and account settings are syncing for this session.",
    settingsTitle: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    japaneseLearnerMode: "Japanese Learner Mode",
    japaneseLearnerModeHint:
      "Switches app text to Japanese and uses English-to-Japanese translations when adding words.",
    japaneseLearnerModeOn: "On",
    japaneseLearnerModeOff: "Off",
    selectBook: "Select a Book",
    noBooksFound: "No books found. Create a new book in the My Books tab first.",
    chapterManagement: "Chapter Management",
    chaptersSuffix: " Chapters",
    selectBookFirst: "Select a book first.",
    createChapterPlaceholder: "Create chapter...",
    addChapter: "Add Chapter",
    delete: "Delete",
    wordSingular: "word",
    wordPlural: "words",
    addWordPlaceholder: "Add English word...",
    definitionAttributionDictionary:
      "Definition data is fetched through the backend with Free Dictionary API (dictionaryapi.dev) plus fallback sources and caching for reliability.",
    definitionAttributionTranslator:
      "Translation data is fetched from Jisho (jisho.org) for English-to-Japanese learning.",
    autoAssignChapters: "Auto-Assign Chapters",
    manageChapters: "Manage Chapters",
    duplicateWord: "That word is already in this chapter.",
    duplicateWordTitle: "Duplicate Word",
    invalidEnglishWord: "Please enter a valid English word.",
    invalidEnglishWordTitle: "Invalid Word",
    definitionRequired: "A valid definition is required before this word can be added.",
    definitionRequiredTitle: "Definition Required",
    translationRequired: "No Japanese translation was returned. Try another English word.",
    translationRequiredTitle: "Translation Missing",
    jishoWordUnavailable: "This word is not available in Jisho. Please try a different English word.",
    jishoWordUnavailableTitle: "Word Not Available",
    translationConnectionError:
      "Cannot connect to the translation service. In local development, start the API server with `npm run dev:server`.",
    translationConnectionErrorTitle: "Connection Error",
    dictionaryNetworkError: "Failed to fetch definition.",
    translationNetworkError: "Failed to fetch translation.",
    networkErrorTitle: "Network Error",
  },
  ja: {
    navDashboard: "ダッシュボード",
    navMyBooks: "マイブック",
    navData: "データ",
    navDefinitions: "単語追加",
    navFlashcards: "フラッシュカード",
    navQuiz: "クイズ",
    navSocials: "ソーシャル",
    recentBooks: "最近のブック",
    noBooksYet: "ブックがまだありません",
    settings: "設定",
    myAccount: "アカウント",
    syncingAccount: "アカウント同期中",
    loadingAccountData: "アカウントデータを読み込み中",
    syncingSession: "ブック、進捗、設定をこのセッションに同期しています。",
    settingsTitle: "設定",
    appearance: "表示",
    theme: "テーマ",
    japaneseLearnerMode: "日本語学習者モード",
    japaneseLearnerModeHint:
      "アプリ表示を日本語にし、単語追加時は英語→日本語の翻訳を使います。",
    japaneseLearnerModeOn: "オン",
    japaneseLearnerModeOff: "オフ",
    selectBook: "ブックを選択",
    noBooksFound: "ブックが見つかりません。まず「マイブック」で作成してください。",
    chapterManagement: "章の管理",
    chaptersSuffix: "の章",
    selectBookFirst: "先にブックを選択してください。",
    createChapterPlaceholder: "章を作成...",
    addChapter: "章を追加",
    delete: "削除",
    wordSingular: "単語",
    wordPlural: "単語",
    addWordPlaceholder: "英単語を追加...",
    definitionAttributionDictionary:
      "定義データは Free Dictionary API（dictionaryapi.dev）から取得しています。",
    definitionAttributionTranslator:
      "翻訳データは英語学習向けに Jisho（jisho.org）から取得しています。",
    autoAssignChapters: "章の自動割り当て",
    manageChapters: "章を管理",
    duplicateWord: "この単語はこの章に既にあります。",
    duplicateWordTitle: "重複単語",
    invalidEnglishWord: "有効な英単語を入力してください。",
    invalidEnglishWordTitle: "無効な単語",
    definitionRequired: "有効な定義が必要です。",
    definitionRequiredTitle: "定義が必要です",
    translationRequired: "日本語訳が取得できませんでした。別の英単語を試してください。",
    translationRequiredTitle: "翻訳が見つかりません",
    jishoWordUnavailable: "この単語はJishoで見つかりません。別の英単語を入力してください。",
    jishoWordUnavailableTitle: "単語が見つかりません",
    translationConnectionError:
      "翻訳サービスに接続できません。ローカル開発では `npm run dev:server` を起動してください。",
    translationConnectionErrorTitle: "接続エラー",
    dictionaryNetworkError: "定義の取得に失敗しました。",
    translationNetworkError: "翻訳の取得に失敗しました。",
    networkErrorTitle: "通信エラー",
  },
};
const WORD_DIFFICULTY_OPTIONS = [
  { value: "a1", label: "A1" },
  { value: "a2", label: "A2" },
  { value: "b1", label: "B1" },
  { value: "b2", label: "B2" },
  { value: "c1", label: "C1" },
  { value: "c2", label: "C2" },
];
const WORD_DIFFICULTY_VALUE_SET = new Set(WORD_DIFFICULTY_OPTIONS.map((option) => option.value));
const ALL_QUIZ_DIFFICULTY_KEYS = ["unassigned", ...WORD_DIFFICULTY_OPTIONS.map((option) => option.value)];
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

async function fetchEnglishDefinitions(word) {
  const input = String(word || "").trim();
  if (!input) {
    return {
      definitions: [],
      pronunciation: "",
      provider: "",
      error: "definition-word-required",
    };
  }

  const endpointCandidates = [`${DEFINITION_API_PATH}/en`];
  const onLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!API_BASE_URL && onLocalhost) {
    endpointCandidates.push("http://localhost:4000/api/define/en");
  }

  const triedEndpoints = new Set();
  let lastErrorCode = "";

  for (const endpoint of endpointCandidates) {
    const normalizedEndpoint = String(endpoint || "").trim();
    if (!normalizedEndpoint || triedEndpoints.has(normalizedEndpoint)) continue;
    triedEndpoints.add(normalizedEndpoint);

    try {
      const res = await fetch(normalizedEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: input }),
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        const definitions = Array.isArray(payload?.definitions)
          ? payload.definitions.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        return {
          definitions,
          pronunciation: String(payload?.pronunciation || "").trim(),
          provider: String(payload?.provider || "backend").trim().toLowerCase(),
          error: definitions.length ? "" : "definition-not-found",
        };
      }

      const errorCode = String(payload?.error || "")
        .trim()
        .toLowerCase();
      if (
        errorCode === "definition-not-found" ||
        errorCode === "invalid-english-word" ||
        errorCode === "definition-word-required"
      ) {
        return {
          definitions: [],
          pronunciation: "",
          provider: "backend",
          error: errorCode || "definition-not-found",
        };
      }
      lastErrorCode = errorCode || "definition-provider-failed";
    } catch {
      lastErrorCode = "definition-provider-failed";
    }
  }

  return {
    definitions: [],
    pronunciation: "",
    provider: "backend",
    error: lastErrorCode || "definition-request-failed",
  };
}

async function fetchJapaneseTranslations(word) {
  const input = String(word || "").trim();
  if (!input) return { translations: [], provider: "", error: "" };
  const hasJapanese = (value) => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
  const isJishoCompatibleInput = (value) => /^[a-z][a-z0-9' -]{1,63}$/i.test(String(value || "").trim());

  const normalize = (values) => {
    const cleaned = values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .slice(0, 10);
    const japanese = cleaned.filter((value) => hasJapanese(value));
    return (japanese.length ? japanese : cleaned).slice(0, 6);
  };

  const fetchJishoDirect = async () => {
    if (!isJishoCompatibleInput(input)) {
      return { translations: [], provider: "jisho-direct", error: "jisho-word-not-available" };
    }

    try {
      const res = await fetch(
        `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(input)}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );
      if (!res.ok) {
        return { translations: [], provider: "jisho-direct", error: "translation-provider-failed" };
      }

      const payload = await res.json().catch(() => null);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const candidates = [];
      const seen = new Set();

      items.slice(0, 10).forEach((item) => {
        const japaneseList = Array.isArray(item?.japanese) ? item.japanese : [];
        japaneseList.forEach((jpEntry) => {
          const candidate = String(jpEntry?.word || jpEntry?.reading || "").trim();
          if (!candidate) return;
          const key = candidate.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          candidates.push(candidate);
        });
      });

      const translations = normalize(candidates);
      if (!translations.length) {
        return { translations: [], provider: "jisho-direct", error: "jisho-word-not-available" };
      }
      return { translations, provider: "jisho-direct", error: "" };
    } catch {
      return { translations: [], provider: "jisho-direct", error: "translation-provider-failed" };
    }
  };

  const endpointCandidates = [`${TRANSLATION_API_PATH}/en-ja`];
  const onLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!API_BASE_URL && onLocalhost) {
    endpointCandidates.push("http://localhost:4000/api/translate/en-ja");
  }

  const triedEndpoints = new Set();
  let sawApiConnectionError = false;

  for (const endpoint of endpointCandidates) {
    const normalizedEndpoint = String(endpoint || "").trim();
    if (!normalizedEndpoint || triedEndpoints.has(normalizedEndpoint)) continue;
    triedEndpoints.add(normalizedEndpoint);

    try {
      const res = await fetch(normalizedEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        const values = Array.isArray(payload?.translations) ? payload.translations : [];
        const normalized = normalize(values);
        if (normalized.length) {
          const provider = String(payload?.provider || "backend")
            .trim()
            .toLowerCase();
          return {
            translations: normalized,
            provider: provider || "backend",
            error: "",
          };
        }
      }

      const errorCode = String(payload?.error || "")
        .trim()
        .toLowerCase();
      if (errorCode === "jisho-word-not-available") {
        return { translations: [], provider: "jisho", error: errorCode };
      }
      if (errorCode === "translation-provider-failed") {
        sawApiConnectionError = true;
      }
    } catch {
      sawApiConnectionError = true;
    }
  }

  const directResult = await fetchJishoDirect();
  if (directResult.translations.length > 0 || directResult.error === "jisho-word-not-available") {
    return directResult;
  }
  if (sawApiConnectionError && directResult.error === "translation-provider-failed") {
    return {
      translations: [],
      provider: directResult.provider || "",
      error: "translation-connection-error",
    };
  }
  return directResult;
}

function parseJsonSafely(rawValue, fallbackValue) {
  if (!rawValue) return fallbackValue;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

function parseStoredStreak(rawValue) {
  const parsed = parseJsonSafely(rawValue, null);
  const count = Math.max(1, Math.floor(Number(parsed?.count) || 1));
  const lastDate = parsed?.lastDate ? getCurrentDayKey(new Date(parsed.lastDate)) : null;
  return { count, lastDate };
}

function parseStoredBoolean(value, fallbackValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallbackValue;
}

function parseStoredUiLanguage(value, fallbackValue = "en") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "ja" || normalized === "en" ? normalized : fallbackValue;
}

function parseStoredDictionaryPreference(value, fallbackValue = "en_en") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "en_ja" || normalized === "en_en" ? normalized : fallbackValue;
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
    : [...ALL_QUIZ_DIFFICULTY_KEYS];
  const mode = normalizeQuizMode(parsed.mode, "normal");

  if (bookIds.length === 0 || chapterKeys.length === 0) return null;

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
    typingAttempts: Math.max(0, Math.floor(Number(rawUsage.typingAttempts) || 0)),
    mistakeReviewAttempts: Math.max(0, Math.floor(Number(rawUsage.mistakeReviewAttempts) || 0)),
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
  "Excellent answer. You're making great progress.",
];
const QUIZ_SUCCESS_PROMPTS_JA = [
  "いいですね。その調子です。",
  "素晴らしいです。勢いを維持しましょう。",
  "正解です。着実に記憶できています。",
  "とても良い回答です。順調に上達しています。",
];

const QUIZ_MISS_PROMPTS = [
  "Close one. Every miss sharpens your memory.",
  "No stress. Mistakes are part of learning.",
  "Keep going. You'll lock this word in soon.",
  "Good try. Review it once and you'll get it next time.",
];
const QUIZ_MISS_PROMPTS_JA = [
  "惜しいです。間違いも記憶の定着に役立ちます。",
  "大丈夫です。ミスは学習の一部です。",
  "このまま続けましょう。すぐに覚えられます。",
  "よく挑戦しました。復習すれば次は正解できます。",
];

export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("vocab_theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [preferredLanguage, setPreferredLanguage] = useState(() => {
    const legacyJapaneseMode = parseStoredBoolean(localStorage.getItem(JAPANESE_LEARNER_MODE_STORAGE_KEY), false);
    const fallbackLanguage = legacyJapaneseMode ? "ja" : "en";
    return parseStoredUiLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE_KEY), fallbackLanguage);
  });
  const [dictionaryPreference, setDictionaryPreference] = useState(() => {
    const legacyJapaneseMode = parseStoredBoolean(localStorage.getItem(JAPANESE_LEARNER_MODE_STORAGE_KEY), false);
    const fallbackPreference = legacyJapaneseMode ? "en_ja" : "en_en";
    return parseStoredDictionaryPreference(
      localStorage.getItem(DICTIONARY_PREFERENCE_STORAGE_KEY),
      fallbackPreference
    );
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
  const [proDailyGoalQuestions, setProDailyGoalQuestions] = useState(() =>
    parseDailyGoalTarget(localStorage.getItem("vocab_pro_daily_goal_questions"))
  );
  const [authToken, setAuthToken] = useState(() => {
    const savedAuthToken = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
    return isBearerAuthToken(savedAuthToken) ? savedAuthToken : "";
  });
  const [authUsername, setAuthUsername] = useState(
    () => localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || ""
  );
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    preferredLanguage,
    dictionaryPreference,
    acceptedLegal: false,
    marketingOptIn: false,
  });
  const [authError, setAuthError] = useState("");
  const [isAuthSessionResolved, setIsAuthSessionResolved] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 700px)").matches;
  });
  const [selectedDataTimeframe, setSelectedDataTimeframe] = useState("weekly");
  const [billingPlan, setBillingPlan] = useState("free");
  const [isLifetimePro, setIsLifetimePro] = useState(false);
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
  const [schoolCodeInput, setSchoolCodeInput] = useState("");
  const [accountActionError, setAccountActionError] = useState("");
  const [isSchoolCodeRedeeming, setIsSchoolCodeRedeeming] = useState(false);
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
  const isJapaneseUi = preferredLanguage === "ja";
  const useEnglishToJapaneseDictionary = dictionaryPreference === "en_ja";
  const appLocale = isJapaneseUi ? "ja" : "en";
  const uiText = APP_TEXT[appLocale] || APP_TEXT.en;
  const tr = (en, ja) => (isJapaneseUi ? ja : en);
  const showLocalTranslationDebug =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const modalRef = useRef(null);
  const sidebarRef = useRef(null);
  const backupFileInputRef = useRef(null);
  const pronunciationFetchInFlightRef = useRef(new Set());
  const sessionStartedAtRef = useRef(Date.now());
  const lastUserActivityAtRef = useRef(Date.now());
  const pendingMistakeReviewSourceRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 700px)");
    const syncMobileViewport = () => setIsMobileViewport(media.matches);
    syncMobileViewport();
    media.addEventListener("change", syncMobileViewport);
    return () => media.removeEventListener("change", syncMobileViewport);
  }, []);

  const currentBook = books.find((b) => b.id === currentBookId);
  const currentBookChapters = getBookChapterList(currentBook);
  const fallbackChapterId = currentBookChapters[0]?.id || DEFAULT_CHAPTER_ID;
  const safeSelectedChapterIdForNewWords = currentBookChapters.some(
    (chapter) => chapter.id === selectedChapterIdForNewWords
  )
    ? selectedChapterIdForNewWords
    : fallbackChapterId;
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
  const lastQuizMistakeKeySet = new Set(lastQuizMistakeKeys);
  const quizSetupWords = quizSetupBooks.flatMap((book) =>
    (book.words || [])
      .filter((wordEntry) => {
        const chapterKey = `${book.id}:${wordEntry.chapterId}`;
        if (!quizSetupChapterKeySet.has(chapterKey)) return false;

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
      difficultyKeys: [...ALL_QUIZ_DIFFICULTY_KEYS],
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
      difficulty_count: 0,
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

  const handleQuizTryAgain = useCallback(() => {
    if (isProPlan) {
      return true;
    }

    if (activeQuizMode === "typing") {
      const safeUsage = ensureCurrentFreeDailyUsage(freeDailyUsage);
      if (safeUsage.typingAttempts >= FREE_DAILY_TYPING_LIMIT) {
        openNoticeModal(
          `Free plan limit reached: ${FREE_DAILY_TYPING_LIMIT} typing quiz starts per day.`,
          "Daily Limit"
        );
        return false;
      }

      setFreeDailyUsage((prev) => {
        const current = ensureCurrentFreeDailyUsage(prev);
        return {
          ...current,
          typingAttempts: current.typingAttempts + 1,
        };
      });
      return true;
    }

    if (activeQuizIsMistakeReview || activeQuizMode === "mistake") {
      const safeUsage = ensureCurrentFreeDailyUsage(freeDailyUsage);
      if (safeUsage.mistakeReviewAttempts >= FREE_DAILY_MISTAKE_REVIEW_LIMIT) {
        openNoticeModal(
          `Free plan limit reached: ${FREE_DAILY_MISTAKE_REVIEW_LIMIT} mistake review starts per day.`,
          "Daily Limit"
        );
        return false;
      }

      setFreeDailyUsage((prev) => {
        const current = ensureCurrentFreeDailyUsage(prev);
        return {
          ...current,
          mistakeReviewAttempts: current.mistakeReviewAttempts + 1,
        };
      });
    }

    return true;
  }, [activeQuizIsMistakeReview, activeQuizMode, freeDailyUsage, isProPlan]);

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
          <h1>{uiText.syncingAccount}</h1>
        </div>
        <div className="analyticsSection">
          <div className="analyticsCard settingsCard accountSyncCard">
            <div className="spinner" aria-hidden="true"></div>
            <h3>{uiText.loadingAccountData}</h3>
            <p className="settingsHint">
              {uiText.syncingSession}
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
                <span className="sidebarNavBtnLabel">{uiText.navDashboard}</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83C\uDFE0"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${screen === "books" ? "isActive" : ""}`}
                onClick={() => setScreen("books")}
              >
                <span className="sidebarNavBtnLabel">{uiText.navMyBooks}</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDCDA"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${screen === "data" ? "isActive" : ""}`}
                onClick={() => setScreen("data")}
              >
                <span className="sidebarNavBtnLabel">{uiText.navData}</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDCCA"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inDefinitions ? "isActive" : ""}`}
                onClick={() => setScreen("definitionsSelect")}
              >
                <span className="sidebarNavBtnLabel">{uiText.navDefinitions}</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDCD8"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inFlashcards ? "isActive" : ""}`}
                onClick={() => setScreen("flashcardsSelect")}
              >
                <span className="sidebarNavBtnLabel">{uiText.navFlashcards}</span>
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
                <span className="sidebarNavBtnLabel">{uiText.navQuiz}</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\u2705"}</span>
              </button>
              <button
                type="button"
                className={`sidebarNavBtn ${inSocial ? "isActive" : ""}`}
                onClick={() => setScreen("socialLeaderboard")}
              >
                <span className="sidebarNavBtnLabel">{uiText.navSocials}</span>
                <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\uD83D\uDC65"}</span>
              </button>
            </nav>
            <div className="sidebarSection">
              <p className="sidebarSectionTitle">{uiText.recentBooks}</p>
              <div className="sidebarBooks">
                {sidebarBookShortcuts.length === 0 ? (
                  <p className="sidebarEmptyText">{uiText.noBooksYet}</p>
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
              <p className="sidebarSectionTitle">{uiText.settings}</p>
              <div className="sidebarBooks">
                <button
                  type="button"
                  className={`sidebarNavBtn ${screen === "settings" ? "isActive" : ""}`}
                  onClick={() => setScreen("settings")}
                >
                  <span className="sidebarNavBtnLabel">{uiText.settings}</span>
                  <span className="sidebarNavBtnEmoji" aria-hidden="true">{"\u2699\uFE0F"}</span>
                </button>
                <button
                  type="button"
                  className={`sidebarNavBtn ${screen === "account" ? "isActive" : ""}`}
                  onClick={() => setScreen("account")}
                >
                  <span className="sidebarNavBtnLabel">{uiText.myAccount}</span>
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
      vocab_theme: theme,
      [UI_LANGUAGE_STORAGE_KEY]: preferredLanguage,
      [DICTIONARY_PREFERENCE_STORAGE_KEY]: dictionaryPreference,
      vocab_sidebar_hidden: JSON.stringify(isSidebarHidden),
      vocab_weekly_stats: JSON.stringify(weeklyStats),
      vocab_activity_history: JSON.stringify(activityHistory),
      vocab_pro_daily_goal_questions: JSON.stringify(proDailyGoalQuestions),
      vocab_free_daily_usage: JSON.stringify(freeDailyUsage),
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
    localStorage.removeItem(JAPANESE_LEARNER_MODE_STORAGE_KEY);
    if (isBearerAuthToken(authToken)) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }, [
    books,
    theme,
    preferredLanguage,
    dictionaryPreference,
    isSidebarHidden,
    weeklyStats,
    activityHistory,
    proDailyGoalQuestions,
    freeDailyUsage,
    lastQuizMistakeKeys,
    lastQuizMistakeKeysByBook,
    lastQuizMistakeMode,
    lastQuizMistakeModeByBook,
    lastQuizSetup,
    streak,
    authToken,
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
    const registerPreferredLanguage = parseStoredUiLanguage(
      authForm.preferredLanguage,
      preferredLanguage
    );
    const registerDictionaryPreference = parseStoredDictionaryPreference(
      authForm.dictionaryPreference,
      dictionaryPreference
    );

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
                preferredLanguage: registerPreferredLanguage,
                dictionaryPreference: registerDictionaryPreference,
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
      const nextAuthToken = String(payload?.authToken || "").trim();
      const safeUserId = Number(payload?.userId);
      if (isBearerAuthToken(nextAuthToken)) {
        setAuthToken(nextAuthToken);
      } else {
        setAuthToken(COOKIE_SESSION_AUTH_MARKER);
      }
      setAuthUsername(nextUsername);
      if (Number.isFinite(safeUserId) && safeUserId > 0) {
        identifyAnalyticsUser(safeUserId, {
          username: nextUsername,
          auth_method: "password",
        });
      }
      if (mode === "register") {
        setPreferredLanguage(registerPreferredLanguage);
        setDictionaryPreference(registerDictionaryPreference);
      }
      setAuthForm({
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        preferredLanguage: registerPreferredLanguage,
        dictionaryPreference: registerDictionaryPreference,
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
    setIsLifetimePro(false);
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
      preferredLanguage,
      dictionaryPreference,
      acceptedLegal: false,
      marketingOptIn: false,
    });
    setAccountSecurityForm({
      resetEmail: "",
      deletePassword: "",
    });
    setSchoolCodeInput("");
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
        const nextPlan = String(payload?.plan || "").trim().toLowerCase() === "pro" ? "pro" : "free";
        const nextIsLifetimePro = Boolean(payload?.isLifetimePro);
        const safeUserId = Number(payload?.userId);
        setAuthToken(COOKIE_SESSION_AUTH_MARKER);
        if (nextUsername) setAuthUsername(nextUsername);
        setAccountEmail(nextEmail);
        setBillingPlan(nextIsLifetimePro ? "pro" : nextPlan);
        setIsLifetimePro(nextIsLifetimePro);
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
      const nextPlan = String(payload?.plan || "").trim().toLowerCase() === "pro" ? "pro" : "free";
      const nextIsLifetimePro = Boolean(payload?.isLifetimePro);
      const safeUserId = Number(payload?.userId);
      if (nextUsername) setAuthUsername(nextUsername);
      setAccountEmail(nextEmail);
      setBillingPlan(nextIsLifetimePro ? "pro" : nextPlan);
      setIsLifetimePro(nextIsLifetimePro);
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

      const nextPlan = String(payload?.plan || "free").trim().toLowerCase() === "pro" ? "pro" : "free";
      const nextIsLifetimePro = Boolean(payload?.isLifetimePro);
      setBillingPlan(nextIsLifetimePro ? "pro" : nextPlan);
      setIsLifetimePro(nextIsLifetimePro);
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
    if (backendError === "invalid-school-code") return "Enter a valid school code.";
    if (backendError === "school-code-not-found") return "School code not found.";
    if (backendError === "school-code-inactive") return "This school code is inactive.";
    if (backendError === "school-code-expired") return "This school code has expired.";
    if (backendError === "school-code-limit-reached") return "This school code has reached its activation limit.";
    if (backendError === "school-code-already-redeemed") return "A school code was already used on this account.";
    if (backendError === "missing-auth-token" || backendError === "invalid-auth-token") {
      return "Your session expired. Please log in again.";
    }
    return fallbackMessage;
  }

  async function redeemSchoolCode() {
    if (!authToken || isSchoolCodeRedeeming) return;
    const normalizedCode = String(schoolCodeInput || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedCode) {
      setAccountActionError("Enter your school code.");
      return;
    }

    setIsSchoolCodeRedeeming(true);
    setAccountActionError("");
    try {
      const response = await fetch(`${AUTH_API_PATH}/account/redeem-school-code`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ code: normalizedCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logoutAccount();
        setAuthError("Your session expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        setAccountActionError(
          mapAccountApiError(payload, "Could not redeem school code. Please try again.")
        );
        return;
      }

      const nextPlan = String(payload?.plan || "free").trim().toLowerCase() === "pro" ? "pro" : "free";
      const nextIsLifetimePro = Boolean(payload?.isLifetimePro);
      setBillingPlan(nextIsLifetimePro ? "pro" : nextPlan);
      setIsLifetimePro(nextIsLifetimePro);
      setSchoolCodeInput("");
      const schoolName = String(payload?.schoolName || "").trim();
      openNoticeModal(
        schoolName
          ? `School code applied for ${schoolName}. Your plan is now Pro.`
          : "School code applied. Your plan is now Pro.",
        "Plan Updated"
      );
    } catch {
      setAccountActionError("Could not redeem school code. Please check your connection and try again.");
    } finally {
      setIsSchoolCodeRedeeming(false);
    }
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
    if (
      billingPlan === "pro" &&
      !isLifetimePro &&
      !isCanceledSubscriptionStatus(billingSubscriptionStatus)
    ) {
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
    if (
      billingPlan === "pro" &&
      !isLifetimePro &&
      !isCanceledSubscriptionStatus(billingSubscriptionStatus)
    ) {
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
              isSidebarHidden,
              preferredLanguage,
              dictionaryPreference,
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
    isSidebarHidden,
    preferredLanguage,
    dictionaryPreference,
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
    localStorage.removeItem("vocab_xp");
    localStorage.removeItem("vocab_levels_enabled");
  }, []);

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
    const validBookIds = new Set(allBookIds);
    const validChapterKeys = new Set(allChapterKeys);

    setQuizSetupSelection((prev) => {
      const nextBookIds = prev.bookIds.filter((id) => validBookIds.has(id));
      const nextChapterKeys = prev.chapterKeys.filter((key) => validChapterKeys.has(key));
      const finalSelection = {
        bookIds: nextBookIds,
        chapterKeys: nextChapterKeys,
        difficultyKeys: [...ALL_QUIZ_DIFFICULTY_KEYS],
      };

      if (
        areStringArraysEqual(prev.bookIds, finalSelection.bookIds) &&
        areStringArraysEqual(prev.chapterKeys, finalSelection.chapterKeys)
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
          const definitionResult = await fetchEnglishDefinitions(word);
          const pronunciation = String(definitionResult?.pronunciation || "").trim();
          const definitionProvider = String(definitionResult?.provider || "").trim().toLowerCase();
          if (!pronunciation || cancelled) continue;

          setBooks((prevBooks) =>
            prevBooks.map((book) => {
              if (book.id !== currentBook.id) return book;

              return {
                ...book,
                words: book.words.map((w) =>
                  w.word === word && !String(w.pronunciation || w.pronounciation || "").trim()
                    ? {
                        ...w,
                        pronunciation,
                        definitionProvider: String(w.definitionProvider || "").trim() || definitionProvider,
                      }
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
    const legacyJapaneseMode = parseStoredBoolean(rawData?.isJapaneseLearnerMode, false);
    const importedPreferredLanguage = parseStoredUiLanguage(
      rawData?.preferredLanguage,
      legacyJapaneseMode ? "ja" : preferredLanguage
    );
    const importedDictionaryPreference = parseStoredDictionaryPreference(
      rawData?.dictionaryPreference,
      legacyJapaneseMode ? "en_ja" : dictionaryPreference
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
    const importedLastQuizSetup =
      rawData?.lastQuizSetup && typeof rawData.lastQuizSetup === "object" && !Array.isArray(rawData.lastQuizSetup)
        ? parseStoredQuizSetup(JSON.stringify(rawData.lastQuizSetup))
        : null;

    setTheme(importedTheme);
    setBooks(importedBooks);
    setStreak(importedStreak);
    setIsSidebarHidden(importedSidebarHidden);
    setWeeklyStats(importedWeeklyStats);
    setActivityHistory(importedActivityHistory);
    setFreeDailyUsage(importedFreeDailyUsage);
    setProDailyGoalQuestions(importedProDailyGoalQuestions);
    setPreferredLanguage(importedPreferredLanguage);
    setDictionaryPreference(importedDictionaryPreference);
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
      preferredLanguage,
      dictionaryPreference,
    });
  }

  function buildBackupSnapshot() {
    return {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        theme,
        books,
        streak,
        isSidebarHidden,
        weeklyStats,
        activityHistory,
        freeDailyUsage,
        proDailyGoalQuestions,
        preferredLanguage,
        dictionaryPreference,
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
            <h3 id="create-book-title">{tr("Create Book", "ブック作成")}</h3>
            <input
              value={newBookName}
              onChange={(e) => setNewBookName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBook()}
              placeholder={tr("Enter book name", "ブック名を入力")}
              autoFocus
            />
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setIsAddBookModalOpen(false)}>
                {tr("Cancel", "キャンセル")}
              </button>
              <button
                type="button"
                className="modalBtn primary"
                onClick={createBook}
                disabled={!newBookName.trim()}
              >
                {tr("Create", "作成")}
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
            <h3 id="rename-book-title">{tr("Rename Book", "ブック名を変更")}</h3>
            <input
              value={renamedBookName}
              onChange={(e) => setRenamedBookName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmRenameBook()}
              placeholder={tr("Enter new book name", "新しいブック名を入力")}
              autoFocus
            />
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setBookPendingRename(null)}>
                {tr("Cancel", "キャンセル")}
              </button>
              <button
                type="button"
                className="modalBtn primary"
                onClick={confirmRenameBook}
                disabled={!renamedBookName.trim()}
              >
                {tr("Save", "保存")}
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
            <h3 id="change-password-title">{tr("Reset Password", "パスワード再設定")}</h3>
            <p className="settingsHint">{tr("Enter the email associated with this account.", "このアカウントのメールアドレスを入力してください。")}</p>
            <input
              className="settingsInput"
              type="email"
              value={accountSecurityForm.resetEmail}
              onChange={(event) => {
                setAccountSecurityForm((prev) => ({ ...prev, resetEmail: event.target.value }));
                if (accountActionError) setAccountActionError("");
              }}
              placeholder={tr("account email", "アカウントメール")}
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
                {tr("Cancel", "キャンセル")}
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
                {isPasswordChangeSubmitting ? tr("Please wait...", "処理中...") : tr("Send Reset Email", "再設定メール送信")}
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
            <h3 id="delete-account-confirm-title">{tr("Delete Account?", "アカウントを削除しますか？")}</h3>
            <p>
              {tr("This permanently removes your account and cloud data. This action cannot be undone.", "アカウントとクラウドデータを完全削除します。この操作は取り消せません。")}
            </p>
            <div className="modalActions">
              <button
                type="button"
                className="modalBtn ghost"
                onClick={() => setIsDeleteAccountConfirmOpen(false)}
              >
                {tr("Cancel", "キャンセル")}
              </button>
              <button
                type="button"
                className="modalBtn danger"
                onClick={deleteAccountPermanently}
                disabled={isDeleteAccountSubmitting}
              >
                {isDeleteAccountSubmitting ? tr("Deleting...", "削除中...") : tr("Delete Account", "アカウント削除")}
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
        billingPlan === "pro" &&
        !isLifetimePro &&
        !isCanceledSubscriptionStatus(billingSubscriptionStatus);

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
                <h3 id="account-panel-title">{tr("Plan", "プラン")}</h3>
                <p className="settingsHint">
                  {tr("Current plan", "現在のプラン")}:{" "}
                  <strong className="billingPlanLabel">{billingPlan === "pro" ? tr("Pro", "Pro") : tr("Free", "無料")}</strong>
                </p>
                {billingSubscriptionStatus ? (
                  <p className="settingsHint">{tr("Subscription status", "サブスク状態")}: {billingSubscriptionStatus}</p>
                ) : null}
                {isLifetimePro ? (
                  <p className="settingsHint">{tr("Lifetime Pro access: enabled (no recurring subscription).", "永久Proが有効です（定期課金なし）。")}</p>
                ) : null}
                {billingPeriodEndLabel ? (
                  <p className="settingsHint">{tr("Current period ends", "現在の期間終了日")}: {billingPeriodEndLabel}</p>
                ) : null}
                <div className="settingsRow">
                  <span>{tr("School code", "スクールコード")}</span>
                  <input
                    className="settingsInput"
                    type="text"
                    value={schoolCodeInput}
                    onChange={(event) => {
                      setSchoolCodeInput(event.target.value.toUpperCase());
                      if (accountActionError) setAccountActionError("");
                    }}
                    placeholder={tr("Enter school code", "スクールコードを入力")}
                    autoComplete="off"
                    maxLength={64}
                    disabled={isSchoolCodeRedeeming}
                  />
                </div>
                <div className="settingsRow">
                  <span>{tr("Apply school access", "スクールアクセスを適用")}</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={redeemSchoolCode}
                    disabled={isSchoolCodeRedeeming || !String(schoolCodeInput || "").trim()}
                  >
                    {isSchoolCodeRedeeming ? tr("Applying...", "適用中...") : tr("Redeem Code", "コードを適用")}
                  </button>
                </div>
                {!isStripeBillingConfigured ? (
                  <p className="settingsHint">
                    {tr("Stripe billing is not configured yet. Add Stripe env vars on the backend.", "Stripe請求が未設定です。バックエンドで環境変数を設定してください。")}
                  </p>
                ) : null}
                {billingPlan === "pro" && !isLifetimePro ? (
                  <div className="settingsRow">
                    <span>{tr("Manage billing", "請求管理")}</span>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={openBillingPortal}
                      disabled={isBillingPortalSubmitting || !isStripeBillingConfigured}
                    >
                      {isBillingPortalSubmitting ? tr("Please wait...", "処理中...") : tr("Manage Subscription", "サブスク管理")}
                    </button>
                  </div>
                ) : billingPlan === "pro" ? (
                  <p className="settingsHint">{tr("Your plan is lifetime Pro. Billing management is not required.", "永久Proのため請求管理は不要です。")}</p>
                ) : (
                  <div className="settingsRow">
                    <span>{PREMIUM_UPGRADE_ENABLED ? tr("Upgrade account", "アカウントをアップグレード") : tr("Pro coming soon", "Proは近日公開")}</span>
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
                        ? tr("Upgrade Coming Soon", "アップグレード近日公開")
                        : isBillingCheckoutSubmitting
                          ? tr("Redirecting...", "移動中...")
                          : tr("Upgrade to Pro", "Proにアップグレード")}
                    </button>
                  </div>
                )}
                {!PREMIUM_UPGRADE_ENABLED ? (
                  <p className="settingsHint">{tr("Pro coming soon.", "Proは近日公開です。")}</p>
                ) : null}
              </>
            ) : null}

            {accountPanelModal === "session" ? (
              <>
                <h3 id="account-panel-title">{tr("Session", "セッション")}</h3>
                <p className="settingsHint">
                  {tr("Signed in as", "ログイン中")}: <strong>{authUsername}</strong>
                </p>
                <div className="settingsRow">
                  <span>{tr("This device", "この端末")}</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={() => logoutAccount({ clearLocalData: true })}
                  >
                    {tr("Log Out", "ログアウト")}
                  </button>
                </div>
                <div className="settingsRow">
                  <span>{tr("All devices", "すべての端末")}</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={logoutAllDevices}
                    disabled={isLogoutAllSubmitting}
                  >
                    {isLogoutAllSubmitting ? tr("Please wait...", "処理中...") : tr("Log Out All Devices", "全端末からログアウト")}
                  </button>
                </div>
              </>
            ) : null}

            {accountPanelModal === "profile" ? (
              <>
                <h3 id="account-panel-title">{tr("Account Info", "アカウント情報")}</h3>
                <div className="settingsRow">
                  <span>{tr("Email", "メール")}</span>
                  <strong className="accountInfoValue">
                    {isAccountProfileLoading ? tr("Loading...", "読み込み中...") : accountEmail || tr("No email available", "メール未設定")}
                  </strong>
                </div>
                <div className="settingsRow">
                  <span>{tr("Username", "ユーザー名")}</span>
                  <strong className="accountInfoValue">{authUsername || tr("Unknown", "不明")}</strong>
                </div>
                <div className="settingsRow accountPasswordRow">
                  <span>{tr("Password", "パスワード")}</span>
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
                      {tr("Change Password", "パスワード変更")}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {accountPanelModal === "preferences" ? (
              <>
                <h3 id="account-panel-title">{tr("Preferences", "\u30D7\u30EC\u30D5\u30A1\u30EC\u30F3\u30B9")}</h3>
                <p className="settingsHint">
                  {tr(
                    "These update your account experience and sync with your cloud state.",
                    "\u3053\u308C\u3089\u306E\u8A2D\u5B9A\u306F\u30A2\u30AB\u30A6\u30F3\u30C8\u4F53\u9A13\u306B\u9069\u7528\u3055\u308C\u3001\u30AF\u30E9\u30A6\u30C9\u72B6\u614B\u306B\u540C\u671F\u3055\u308C\u307E\u3059\u3002"
                  )}
                </p>
                <div className="settingsRow">
                  <span>{tr("Language", "\u8868\u793A\u8A00\u8A9E")}</span>
                  <select
                    className="settingsInput"
                    value={preferredLanguage}
                    onChange={(event) => {
                      setPreferredLanguage(parseStoredUiLanguage(event.target.value, "en"));
                    }}
                  >
                    <option value="en">{tr("English", "\u82F1\u8A9E")}</option>
                    <option value="ja">{tr("Japanese", "\u65E5\u672C\u8A9E")}</option>
                  </select>
                </div>
                <div className="settingsRow">
                  <span>{tr("Dictionary", "\u8F9E\u66F8")}</span>
                  <select
                    className="settingsInput"
                    value={dictionaryPreference}
                    onChange={(event) => {
                      setDictionaryPreference(
                        parseStoredDictionaryPreference(event.target.value, "en_en")
                      );
                    }}
                  >
                    <option value="en_en">
                      {tr("English to English", "\u82F1\u8A9E\u2192\u82F1\u8A9E")}
                    </option>
                    <option value="en_ja">
                      {tr("English to Japanese", "\u82F1\u8A9E\u2192\u65E5\u672C\u8A9E")}
                    </option>
                  </select>
                </div>
                <p className="settingsHint">
                  {tr(
                    "Changes are saved automatically.",
                    "\u5909\u66F4\u306F\u81EA\u52D5\u7684\u306B\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002"
                  )}
                </p>
              </>
            ) : null}

            {accountPanelModal === "danger" ? (
              <>
                <h3 id="account-panel-title">{tr("Danger Zone", "危険操作")}</h3>
                <p className="settingsHint">
                  {tr("Deleting your account permanently removes cloud data and cannot be undone.", "アカウント削除でクラウドデータは完全に消去され、取り消せません。")}
                </p>
                {isAccountDeletionBlockedBySubscription ? (
                  <p className="settingsHint">
                    {tr("Cancel your Pro subscription first. You can delete your account only after status is canceled.", "先にProサブスクを解約してください。状態が canceled になってから削除できます。")}
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
                    placeholder={tr("password to delete account", "削除用パスワード")}
                    autoComplete="current-password"
                    disabled={isAccountDeletionBlockedBySubscription || isBillingStatusLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="settingsPasswordToggleBtn"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? tr("Hide password", "パスワードを隠す") : tr("Show password", "パスワードを表示")}
                    title={isPasswordVisible ? tr("Hide password", "パスワードを隠す") : tr("Show password", "パスワードを表示")}
                    disabled={isAccountDeletionBlockedBySubscription || isBillingStatusLoading}
                  >
                    {"\uD83D\uDC41"}
                  </button>
                </div>
                <div className="settingsRow">
                  <span>{tr("Permanent action", "永久操作")}</span>
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
                    {isDeleteAccountSubmitting ? tr("Deleting...", "削除中...") : tr("Delete Account", "アカウント削除")}
                  </button>
                </div>
              </>
            ) : null}

            {accountActionError ? <p className="settingsErrorText">{accountActionError}</p> : null}
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setAccountPanelModal("")}>
                {tr("Close", "閉じる")}
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
            <h3 id="daily-goal-title">{tr("Daily Goal", "1日の目標")}</h3>
            <p className="settingsHint">
              {tr("Track today's target and jump into your highest-priority review words.", "本日の目標を追跡し、優先度の高い復習に進みましょう。")}
            </p>
            <div className="premiumFocusGrid">
              <div className="premiumFocusMetric">
                <span>{tr("Progress Today", "今日の進捗")}</span>
                <strong>{proDailyGoalProgress} / {proDailyGoalQuestions} {tr("questions", "問")}</strong>
                <div className="premiumProgressTrack" aria-hidden="true">
                  <div className="premiumProgressFill" style={{ width: `${proDailyGoalPercent}%` }} />
                </div>
                <small>{hasMetProDailyGoal ? tr("Goal complete today.", "今日の目標達成。") : tr("Complete quizzes to close the goal.", "クイズを完了して目標達成しましょう。")}</small>
              </div>
              <div className="premiumFocusMetric">
                <span>{tr("Smart Queue", "スマートキュー")}</span>
                <strong>{smartReviewWords.length} {tr("words ready", "語が準備済み")}</strong>
                <small>{tr("Weak words prioritized by your recent performance.", "最近の成績に基づいて弱点単語を優先表示します。")}</small>
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
                  {tr("Goal -5", "目標 -5")}
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
                  {tr("Goal +5", "目標 +5")}
                </button>
                <button
                  type="button"
                  className="modalBtn primary"
                  onClick={() => {
                    setIsDailyGoalModalOpen(false);
                    openSmartReviewSetup();
                  }}
                >
                  {tr("Open Quiz Setup", "クイズ設定を開く")}
                </button>
              </div>
            ) : (
              <div className="modalActions">
                <button
                  type="button"
                  className="modalBtn primary"
                  onClick={() => setIsDailyGoalModalOpen(false)}
                >
                  {tr("Close", "閉じる")}
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
            <h3 id="delete-book-title">{tr("Delete Book", "ブック削除")}</h3>
            <p>{tr(`Delete "${bookPendingDelete.name}"?`, `"${bookPendingDelete.name}" を削除しますか？`)}</p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setBookPendingDelete(null)}>
                {tr("Cancel", "キャンセル")}
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmDeleteBook}>
                {tr("Delete", "削除")}
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
            <h3 id="delete-chapter-title">{tr("Delete Chapter", "章を削除")}</h3>
            <p>{tr(`Delete "${chapterPendingDelete.name}"?`, `"${chapterPendingDelete.name}" を削除しますか？`)}</p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setChapterPendingDelete(null)}>
                {tr("Cancel", "キャンセル")}
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmDeleteChapter}>
                {tr("Delete", "削除")}
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
            <h3 id="delete-word-title">{tr("Delete Tracked Word?", "学習単語を削除しますか？")}</h3>
            <p>
              {tr(`"${wordPendingDelete.word}" is at mastery level ${wordPendingDelete.level} (${wordPendingDelete.label}). Deleting it will remove its progress history.`, `"${wordPendingDelete.word}" は習熟度レベル ${wordPendingDelete.level}（${wordPendingDelete.label}）です。削除すると進捗履歴も消えます。`)}
            </p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setWordPendingDelete(null)}>
                {tr("Cancel", "キャンセル")}
              </button>
              <button type="button" className="modalBtn danger" onClick={confirmDeleteWord}>
                {tr("Delete Word", "単語を削除")}
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
            <h3 id="remove-friend-title">{tr("Remove Friend", "友達を削除")}</h3>
            <p>
              {tr(`Remove @${friendPendingRemove.username || `user_${friendPendingRemove.userId}`} from your friends list?`, `@${friendPendingRemove.username || `user_${friendPendingRemove.userId}`} を友達一覧から削除しますか？`)}
            </p>
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={() => setFriendPendingRemove(null)}>
                {tr("Cancel", "キャンセル")}
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
      difficultyKeys: [...ALL_QUIZ_DIFFICULTY_KEYS],
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
      difficultyKeys: [...ALL_QUIZ_DIFFICULTY_KEYS],
    });
    setIsQuickQuizSetupArmed(true);
    setQuizSetupStep(3);
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
      openNoticeModal(uiText.duplicateWord, uiText.duplicateWordTitle);
      return;
    }

    setLoading(true);
    try {
      let definitions = [];
      let pronunciation = "";
      let translationProvider = "";
      let definitionProvider = "";
      let translationErrorCode = "";

      if (useEnglishToJapaneseDictionary) {
        const translationResult = await fetchJapaneseTranslations(cleanWord);
        definitions = Array.isArray(translationResult?.translations)
          ? translationResult.translations
          : [];
        translationProvider = String(translationResult?.provider || "").trim().toLowerCase();
        translationErrorCode = String(translationResult?.error || "").trim().toLowerCase();
        if (!definitions.length) {
          if (translationErrorCode === "jisho-word-not-available") {
            openNoticeModal(uiText.jishoWordUnavailable, uiText.jishoWordUnavailableTitle);
          } else if (translationErrorCode === "translation-connection-error") {
            openNoticeModal(uiText.translationConnectionError, uiText.translationConnectionErrorTitle);
          } else if (translationErrorCode) {
            openNoticeModal(uiText.translationNetworkError, uiText.networkErrorTitle);
          } else {
            openNoticeModal(uiText.translationRequired, uiText.translationRequiredTitle);
          }
          return;
        }
      } else {
        const definitionResult = await fetchEnglishDefinitions(cleanWord);
        definitions = Array.isArray(definitionResult?.definitions) ? definitionResult.definitions : [];
        pronunciation = String(definitionResult?.pronunciation || "").trim();
        definitionProvider = String(definitionResult?.provider || "").trim().toLowerCase();
        const definitionErrorCode = String(definitionResult?.error || "").trim().toLowerCase();
        if (
          definitionErrorCode === "definition-not-found" ||
          definitionErrorCode === "invalid-english-word" ||
          definitionErrorCode === "definition-word-required"
        ) {
          openNoticeModal(uiText.invalidEnglishWord, uiText.invalidEnglishWordTitle);
          return;
        }
        if (definitionErrorCode) {
          openNoticeModal(uiText.dictionaryNetworkError, uiText.networkErrorTitle);
          return;
        }
      }

      if (!definitions.length) {
        openNoticeModal(uiText.definitionRequired, uiText.definitionRequiredTitle);
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
                  meaningSource: useEnglishToJapaneseDictionary ? "translator_en_ja" : "dictionary_en",
                  translationProvider: useEnglishToJapaneseDictionary ? translationProvider || "unknown" : "",
                  definitionProvider: useEnglishToJapaneseDictionary ? "" : definitionProvider || "unknown",
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
      updateStreak();
      setInputWord("");
    } catch {
      openNoticeModal(
        useEnglishToJapaneseDictionary ? uiText.translationNetworkError : uiText.dictionaryNetworkError,
        uiText.networkErrorTitle
      );
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
                <div className="streakBadge" aria-label="Current streak">
                  {"\uD83D\uDD25"} {streak.count} {tr("day", "日")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="weeklyOverviewSection">
          <h2 className="weeklyOverviewTitle">{tr("Weekly Overview", "週間サマリー")}</h2>
          <div className="weeklyOverviewGrid">
            <div className="weeklyOverviewCard">
              <p className="weeklyOverviewLabel">{tr("Questions Completed", "完了した問題")}</p>
              <strong className="weeklyOverviewValue">{currentWeekStats.questionsCompleted || 0}</strong>
            </div>
            <div className="weeklyOverviewCard">
              <p className="weeklyOverviewLabel">{tr("Time Spent", "学習時間")}</p>
              <strong className="weeklyOverviewValue">{weeklyTimeSpent}</strong>
            </div>
            <div className="weeklyOverviewCard">
              <p className="weeklyOverviewLabel">{tr("Words Added", "追加した単語")}</p>
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
                <p className="weeklyOverviewLabel">{tr("Daily Goal", "1日の目標")}</p>
                <strong className="weeklyOverviewValue">
                  {proDailyGoalProgress} / {proDailyGoalQuestions} {tr("questions", "問")}
                </strong>
                <div className="premiumProgressTrack" aria-hidden="true">
                  <div className="premiumProgressFill" style={{ width: `${proDailyGoalPercent}%` }} />
                </div>
                <span className="settingsHint">{tr("Tap to manage your daily goal.", "タップして目標を管理")}</span>
              </button>
            </>
          ) : null}
        </div>

        <div className="recentSection">
          <h2 className="recentTitle">{tr("Quick Access", "クイックアクセス")}</h2>
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
            <span>{"\uD83D\uDCD8"} {tr("Definitions", "単語追加")}</span>
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
            <span>{"\u26A1"} {tr("Flashcards", "フラッシュカード")}</span>
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
            <span>{"\u2705"} {tr("Quiz", "クイズ")}</span>
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
            <span>{"\uD83D\uDCDA"} {tr("My Books", "マイブック")}</span>
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
            <span>{"\uD83D\uDCCA"} {tr("Data", "データ")}</span>
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
            <span>{"\uD83D\uDC65"} {tr("Socials", "ソーシャル")}</span>
          </div>
          {isMobileViewport ? (
            <div
              className="panelCard wide"
              role="button"
              tabIndex={0}
              onClick={() => setScreen("settings")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setScreen("settings");
                }
              }}
            >
              <span>{"\u2699\uFE0F"} {tr("Settings", "設定")}</span>
            </div>
          ) : null}
          {isMobileViewport ? (
            <div
              className="panelCard wide"
              role="button"
              tabIndex={0}
              onClick={() => setScreen("account")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setScreen("account");
                }
              }}
            >
              <span>{"\uD83D\uDC64"} {tr("My Account", "アカウント")}</span>
            </div>
          ) : null}
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{uiText.settingsTitle}</h1>
        </div>
        <div className="analyticsSection">
          <div className="analyticsGrid">
            <div className="analyticsCard settingsCard">
              <h3>{uiText.appearance}</h3>
              <div className="settingsRow">
                <span>{uiText.theme}</span>
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("My Account", "アカウント")}</h1>
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
                  <h3>{tr("Plan", "プラン")}</h3>
                </div>
                <p className="settingsHint">
                  {billingPlan === "pro"
                    ? isLifetimePro
                      ? tr("View lifetime Pro status.", "永久Proステータスを確認")
                      : tr("Manage subscription and billing details.", "サブスクと請求を管理")
                    : tr("View current billing status.", "現在の請求状況を確認")}
                </p>
                <span className="accountLauncherAction">{tr("Open", "開く")}</span>
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
                  <h3>{tr("Session", "セッション")}</h3>
                </div>
                <p className="settingsHint">{tr("Log out this device or all devices.", "この端末または全端末からログアウト")}</p>
                <span className="accountLauncherAction">{tr("Open", "開く")}</span>
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
                  <h3>{tr("Account Info", "アカウント情報")}</h3>
                </div>
                <p className="settingsHint">{tr("View email, username, and password settings.", "メール・ユーザー名・パスワード設定を確認")}</p>
                <span className="accountLauncherAction">{tr("Open", "開く")}</span>
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
                  <h3>{tr("Danger Zone", "危険操作")}</h3>
                </div>
                <p className="settingsHint">{tr("Delete your account permanently.", "アカウントを完全に削除")}</p>
                <span className="accountLauncherAction">{tr("Open", "開く")}</span>
              </button>
            </div>
          ) : (
            <div className="accountAuthWrap">
              <div className="analyticsCard settingsCard accountCard">
                <h3>{tr("Account", "アカウント")}</h3>
                <>
                  <p className="settingsHint">{tr("Create an account or sign in to sync with backend.", "アカウント作成またはログインして同期")}</p>
                  <div className="settingsAuthModeRow" role="group" aria-label="Choose account action">
                    <button
                      type="button"
                      className={`settingsAuthModeBtn ${authMode === "login" ? "isActive" : ""}`}
                      onClick={() => setAuthMode("login")}
                    >
                      {tr("Login", "ログイン")}
                    </button>
                    <button
                      type="button"
                      className={`settingsAuthModeBtn ${authMode === "register" ? "isActive" : ""}`}
                      onClick={() => setAuthMode("register")}
                    >
                      {tr("Register", "新規登録")}
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
                      placeholder={tr("email", "メールアドレス")}
                      autoComplete="email"
                    />
                  ) : null}
                  {authMode === "register" ? (
                    <select
                      className="settingsInput"
                      value={authForm.preferredLanguage}
                      onChange={(event) => {
                        setAuthForm((prev) => ({ ...prev, preferredLanguage: event.target.value }));
                        if (authError) setAuthError("");
                      }}
                    >
                      <option value="en">{tr("Language: English", "表示言語: 英語")}</option>
                      <option value="ja">{tr("Language: Japanese", "表示言語: 日本語")}</option>
                    </select>
                  ) : null}
                  {authMode === "register" ? (
                    <select
                      className="settingsInput"
                      value={authForm.dictionaryPreference}
                      onChange={(event) => {
                        setAuthForm((prev) => ({ ...prev, dictionaryPreference: event.target.value }));
                        if (authError) setAuthError("");
                      }}
                    >
                      <option value="en_en">
                        {tr("Dictionary: English to English", "辞書: 英語→英語")}
                      </option>
                      <option value="en_ja">
                        {tr("Dictionary: English to Japanese", "辞書: 英語→日本語")}
                      </option>
                    </select>
                  ) : null}
                  <input
                    className="settingsInput"
                    value={authForm.username}
                    onChange={(event) => {
                      setAuthForm((prev) => ({ ...prev, username: event.target.value }));
                      if (authError) setAuthError("");
                    }}
                    placeholder={
                      authMode === "login" ? tr("username or email", "ユーザー名またはメール") : tr("username (a-z, 0-9, _)", "ユーザー名 (a-z, 0-9, _)")
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
                      placeholder={tr("password (min 8 chars)", "パスワード（8文字以上）")}
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      className="settingsPasswordToggleBtn"
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      aria-label={isPasswordVisible ? tr("Hide password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u96a0\u3059") : tr("Show password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u8868\u793a")}
                      title={isPasswordVisible ? tr("Hide password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u96a0\u3059") : tr("Show password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u8868\u793a")}
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
                        placeholder={tr("confirm password", "パスワード確認")}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="settingsPasswordToggleBtn"
                        onClick={() => setIsPasswordVisible((prev) => !prev)}
                        aria-label={isPasswordVisible ? tr("Hide password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u96a0\u3059") : tr("Show password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u8868\u793a")}
                        title={isPasswordVisible ? tr("Hide password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u96a0\u3059") : tr("Show password", "\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u8868\u793a")}
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
                          {tr("I accept the ", "")}<a href="/terms">{tr("Terms & Conditions", "利用規約")}</a>,{" "}
                          <a href="/privacy">{tr("Privacy Policy", "プライバシーポリシー")}</a>{tr(", and ", "、")}{" "}
                          <a href="/disclaimer">{tr("Disclaimer", "免責事項")}</a>{tr("", "に同意します")}
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
                          {tr("Send me product updates, new feature announcements, and learning tips", "製品アップデート・新機能・学習ヒントを受け取る")}
                        </span>
                      </label>
                    </>
                  ) : null}
                  <div className="settingsRow">
                    <span>{authMode === "login" ? tr("Use existing account", "既存アカウントで利用") : tr("Create new account", "新規アカウントを作成")}</span>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={() => submitAuth(authMode)}
                      disabled={isAuthSubmitting}
                    >
                      {isAuthSubmitting
                        ? tr("Please wait...", "処理中...")
                        : authMode === "login"
                          ? tr("Log In", "ログイン")
                          : tr("Register", "登録")}
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
    const leagueLabel = leagueTrack === "pro"
      ? tr("Pro League", "Proリーグ")
      : tr("Free League", "無料リーグ");
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
      ? tr("Monthly", "月間")
      : timeframeKey === "yearly"
        ? tr("Yearly", "年間")
        : timeframeKey === "total"
          ? tr("Total", "累計")
          : tr("Weekly", "週間");
    const timeframeOptions = [
      { value: "weekly", label: tr("Weekly", "週間") },
      { value: "monthly", label: tr("Monthly", "月間") },
      { value: "yearly", label: tr("Yearly", "年間") },
      { value: "total", label: tr("Total", "累計") },
    ];
    const metricKey = socialMetric === "questionsCompleted"
      ? "questionsCompleted"
      : socialMetric === "timeSpentSeconds"
        ? "timeSpentSeconds"
        : "wordsAdded";
    const metricLabel = metricKey === "questionsCompleted"
      ? tr("Questions", "問題数")
      : metricKey === "timeSpentSeconds"
        ? tr("Time Spent", "学習時間")
        : tr("Words Added", "追加単語");
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("Leaderboard", "ランキング")}</h1>
        </div>
        {!authToken ? (
          <p>{tr("Please log in from My Account to use leaderboard features.", "ランキング機能を使うにはアカウントからログインしてください。")}</p>
        ) : (
          <div className="analyticsSection socialSectionStack">
            <div className="analyticsCard">
              <div className="settingsRow">
                <span>{tr("Manage friends and requests", "友達とリクエスト管理")}</span>
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={() => setScreen("socialFriends")}
                >
                  {tr("Go To Friends", "友達管理へ")}
                </button>
              </div>
            </div>
            <div className="analyticsCard socialLeaderboardCard">
              <h3>{tr("Leaderboard", "ランキング")}</h3>
              <p className="settingsHint">
                {tr("Climb the ranks in your plan league.", "所属リーグで順位を上げましょう。")}
              </p>
              <p className="settingsHint">{tr("League", "リーグ")}: {leagueLabel}</p>
              <div className="socialMetricRow">
                <span className="socialTimeframeLabel">
                  {tr("Timeframe", "期間")}
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
                  {tr("Words Added", "追加単語")}
                </button>
                <button
                  type="button"
                  className={`settingsAuthModeBtn ${socialMetric === "questionsCompleted" ? "isActive" : ""}`}
                  onClick={() => setSocialMetric("questionsCompleted")}
                >
                  {tr("Questions", "問題数")}
                </button>
                <button
                  type="button"
                  className={`settingsAuthModeBtn ${socialMetric === "timeSpentSeconds" ? "isActive" : ""}`}
                  onClick={() => setSocialMetric("timeSpentSeconds")}
                >
                  {tr("Time Spent", "学習時間")}
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
                <p className="settingsHint">{tr("No leaderboard data yet.", "ランキングデータはまだありません。")}</p>
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
                              {index === 0 ? <span className="socialLeaderBadge">{tr("Leader", "首位")}</span> : null}
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

            {isSocialLoading ? <p className="settingsHint">{tr("Loading social data...", "ソーシャルデータを読み込み中...")}</p> : null}
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("socialLeaderboard")}>&times;</button>
          <h1>{tr("Manage Friends", "友達管理")}</h1>
        </div>
        {!authToken ? (
          <p>{tr("Please log in from My Account to manage friends.", "友達管理にはアカウントからログインしてください。")}</p>
        ) : (
          <div className="analyticsSection socialSectionStack">
            <div className="analyticsGrid">
              <div className="analyticsCard settingsCard">
                <h3>{tr("Add Friend", "友達を追加")}</h3>
                <p className="settingsHint">{tr("Search by username, then send a friend request.", "ユーザー名で検索して友達申請を送信します。")}</p>
                <input
                  className="settingsInput"
                  value={friendUsernameInput}
                  onChange={(event) => {
                    setFriendUsernameInput(event.target.value);
                    if (socialError) setSocialError("");
                  }}
                  placeholder={tr("friend username", "友達のユーザー名")}
                  autoComplete="off"
                />
                <div className="settingsRow">
                  <span>{tr("Send request", "申請を送信")}</span>
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={sendFriendRequest}
                    disabled={socialActionLoadingKey === "send-request"}
                  >
                    {socialActionLoadingKey === "send-request" ? tr("Sending...", "送信中...") : tr("Add Friend", "友達追加")}
                  </button>
                </div>
              </div>

              <div className="analyticsCard">
                <h3>{tr("Incoming Requests", "受信リクエスト")}</h3>
                {incomingRequests.length === 0 ? (
                  <p className="settingsHint">{tr("No incoming requests.", "受信リクエストはありません。")}</p>
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
                            {tr("Accept", "承認")}
                          </button>
                          <button
                            type="button"
                            className="primaryBtn ghostBtn"
                            onClick={() => respondToFriendRequest(request.requestId, "decline")}
                            disabled={socialActionLoadingKey === `respond-${request.requestId}-decline`}
                          >
                            {tr("Decline", "拒否")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="analyticsCard">
              <h3>{tr("Friends", "友達")}</h3>
              {friendProfiles.length === 0 ? (
                <p className="settingsHint">{tr("Add friends to start competing.", "友達を追加して競争を始めましょう。")}</p>
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
                                {"\uD83D\uDD25"} {friendStreak}{tr("-day streak", "日連続")}
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
                          {tr("Remove", "削除")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="socialOutgoing">
                <h3>{tr("Outgoing Requests", "送信済みリクエスト")}</h3>
                {outgoingRequests.length === 0 ? (
                  <p className="settingsHint">{tr("No outgoing requests.", "送信済みリクエストはありません。")}</p>
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
                          {tr("Cancel Request", "申請を取り消す")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isSocialLoading ? <p className="settingsHint">{tr("Loading social data...", "ソーシャルデータを読み込み中...")}</p> : null}
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
      { key: "daily", title: tr("Daily", "日次"), stats: activityDailyStats },
      { key: "weekly", title: tr("Weekly", "週間"), stats: activityWeeklyStats },
      { key: "monthly", title: tr("Monthly", "月間"), stats: activityMonthlyStats },
      { key: "total", title: tr("Total", "累計"), stats: activityTotalStats },
    ];
    const selectedOverviewCard =
      overviewCards.find((card) => card.key === selectedDataTimeframe) || overviewCards[1];
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("Data", "データ")}</h1>
        </div>

        <div className="analyticsSection">
          {isMobileViewport ? (
            <>
              <div className="dataTimeframeRow">
                <label htmlFor="data-timeframe-select" className="dataTimeframeLabel">
                  {tr("Timeframe", "期間")}
                </label>
                <select
                  id="data-timeframe-select"
                  className="settingsInput dataTimeframeSelect"
                  value={selectedDataTimeframe}
                  onChange={(event) => setSelectedDataTimeframe(String(event.target.value || "weekly"))}
                >
                  {overviewCards.map((card) => (
                    <option key={card.key} value={card.key}>
                      {card.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="activityOverviewGrid activityOverviewGridSingle">
                <div className="activityOverviewCard">
                  <h3>{selectedOverviewCard.title}</h3>
                  <div className="activityOverviewStats">
                    <div className="activityOverviewStat">
                      <span>{tr("Questions", "問題数")}</span>
                      <strong>{selectedOverviewCard.stats.questionsCompleted || 0}</strong>
                    </div>
                    <div className="activityOverviewStat">
                      <span>{tr("Words", "単語")}</span>
                      <strong>{selectedOverviewCard.stats.wordsAdded}</strong>
                    </div>
                    <div className="activityOverviewStat">
                      <span>{tr("Time", "時間")}</span>
                      <strong>{formatWeeklyTime(selectedOverviewCard.stats.timeSpentSeconds)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="activityOverviewGrid">
              {overviewCards.map((card) => (
                <div key={card.key} className="activityOverviewCard">
                  <h3>{card.title}</h3>
                  <div className="activityOverviewStats">
                    <div className="activityOverviewStat">
                      <span>{tr("Questions", "問題数")}</span>
                      <strong>{card.stats.questionsCompleted || 0}</strong>
                    </div>
                    <div className="activityOverviewStat">
                      <span>{tr("Words", "単語")}</span>
                      <strong>{card.stats.wordsAdded}</strong>
                    </div>
                    <div className="activityOverviewStat">
                      <span>{tr("Time", "時間")}</span>
                      <strong>{formatWeeklyTime(card.stats.timeSpentSeconds)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="analyticsGrid">
            <div className="analyticsCard">
              <h3>{tr("Words Added Over Time (Last 14 Days)", "追加単語の推移（過去14日）")}</h3>
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
                  <div className="trendBars" role="img" aria-label={tr("Words added over last 14 days", "過去14日の追加単語")}>
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
              <h3>{tr("Questions Completed Over Time (Last 14 Days)", "解答数の推移（過去14日）")}</h3>
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
                  <div className="trendBars" role="img" aria-label={tr("Questions completed over last 14 days", "過去14日の解答数")}>
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
              <h3>{tr("Words by CEFR Level", "CEFRレベル別単語数")}</h3>
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
                  <div className="difficultyChart" role="img" aria-label={tr("Word count by CEFR level", "CEFRレベル別単語数")}>
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
              <h3>{tr("Words by Mastery Level", "習熟度別単語数")}</h3>
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
                  <div className="difficultyChart masteryChart" role="img" aria-label={tr("Word count by mastery level", "習熟度別単語数")}>
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
                <h3>{tr("Weak-Words Lab", "弱点単語ラボ")}</h3>
              </div>
              <p className="settingsHint">
                {tr("Find the exact words that cost you points and export them for focused drills.", "失点しやすい単語を特定し、集中練習用にエクスポートできます。")}
              </p>
              <p className="quizSetupHint">
                {tr("Rolling window:", "分析期間:")} {WEAK_WORDS_RECENT_DAY_WINDOW}{tr(" days and up to", "日、かつ各単語につき最新")}{" "}
                {WEAK_WORDS_RECENT_QUESTION_WINDOW}{tr(" recent answers per word.", "件まで")}
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
                  <p className="quizSetupHint">{tr("No weak-word data yet. Complete quizzes to build insights.", "弱点データはまだありません。クイズを解いてデータを作成しましょう。")}</p>
                ) : null}
              </div>
              <div className="premiumActionRow">
                <button type="button" className="primaryBtn" onClick={openSmartReviewSetup}>
                  {tr("Open Quiz Setup", "クイズ設定を開く")}
                </button>
                <button type="button" className="primaryBtn" onClick={exportWeakWordsCsv}>
                  {tr("Export Weak Words CSV", "弱点単語CSVを出力")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="analyticsCard backupRestoreCard">
            <h3>{tr("Backup & Restore", "バックアップと復元")}</h3>
            <p className="quizSetupHint">
              {tr("Export your full app data to JSON, or import a previous backup file.", "全データをJSONで出力、またはバックアップを読み込みできます。")}
            </p>
            <div className="quizResultActions">
              <button type="button" className="primaryBtn" onClick={exportBackup}>
                {tr("Export Backup", "バックアップを出力")}
              </button>
              <button
                type="button"
                className="primaryBtn"
                onClick={() => backupFileInputRef.current?.click()}
              >
                {tr("Import Backup", "バックアップを読み込み")}
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("My Books", "マイブック")}</h1>
        </div>
        <button className="primaryBtn" onClick={openAddBookModal}>+ {tr("Add Book", "ブック追加")}</button>
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
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
            <strong>{tr("Definitions", "単語追加")}</strong>
            <p>{tr("Add and manage words, meanings, and chapter placement.", "単語・意味・章を追加/管理します。")}</p>
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
            <strong>{tr("Flashcards", "フラッシュカード")}</strong>
            <p>{tr("Drill recall quickly with focused review sessions.", "集中復習で素早く記憶を強化します。")}</p>
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
            <strong>{tr("Quiz", "クイズ")}</strong>
            <p>{tr("Test active recall with normal, typing, or mistake mode.", "通常・タイピング・ミス復習で能動想起を鍛えます。")}</p>
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{uiText.selectBook}</h1>
        </div>
        {sortedBooksByRecent.length === 0 ? (
          <p className="quizSetupHint">{uiText.noBooksFound}</p>
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("bookMenu")}>&times;</button>
          <h1>{currentBook?.name}</h1>
        </div>
        <div className="inputRow">
          <input
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.nativeEvent?.isComposing) return;
              addWord();
            }}
            placeholder={uiText.addWordPlaceholder}
          />
          <button type="button" className="addWordBtn" onClick={addWord}>+</button>
        </div>
        <p className="definitionAttributionNote">
          {useEnglishToJapaneseDictionary
            ? uiText.definitionAttributionTranslator
            : uiText.definitionAttributionDictionary}
        </p>
        <div className="chapterControlsRow">
          <div className="chapterControlField">
            <span>{uiText.autoAssignChapters}</span>
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
            {uiText.manageChapters}
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
                      {showLocalTranslationDebug &&
                      (String(
                        useEnglishToJapaneseDictionary ? w.translationProvider : w.definitionProvider
                      ).trim()) ? (
                        <span className="translationSourceBadge">
                          {`provider: ${String(
                            useEnglishToJapaneseDictionary ? w.translationProvider : w.definitionProvider
                          ).trim()}`}
                        </span>
                      ) : null}
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("definitions")}>&times;</button>
          <h1>{currentBook?.name ? `${currentBook.name}${uiText.chaptersSuffix}` : uiText.chapterManagement}</h1>
        </div>
        {!currentBook ? (
          <p>{uiText.selectBookFirst}</p>
        ) : (
          <>
            <div className="chapterCreateRow">
              <input
                value={newChapterName}
                onChange={(event) => setNewChapterName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addChapter()}
                placeholder={uiText.createChapterPlaceholder}
              />
              <button
                type="button"
                className="primaryBtn"
                onClick={addChapter}
                disabled={!newChapterName.trim()}
              >
                {uiText.addChapter}
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
                        {wordCount} {wordCount === 1 ? uiText.wordSingular : uiText.wordPlural}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="primaryBtn"
                      onClick={() => askDeleteChapter(chapter)}
                      disabled={currentBookChapters.length <= 1}
                    >
                      {uiText.delete}
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
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{uiText.selectBook}</h1>
        </div>
        {sortedBooksByRecent.length === 0 ? (
          <p className="quizSetupHint">{uiText.noBooksFound}</p>
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
    const selectedBookIdsSet = new Set(quizSetupSelection.bookIds);
    const selectedChapterKeysSet = new Set(quizSetupSelection.chapterKeys);
    const selectedBookCount = quizSetupSelection.bookIds.length;
    const selectedChapterCount = quizSetupSelection.chapterKeys.length;
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
      quizSetupWords.length >= 2;
    const includesTypeStep = true;
    const typeStepIndex = includesTypeStep ? 0 : -1;
    const booksStepIndex = includesTypeStep ? 1 : 0;
    const chaptersStepIndex = includesTypeStep ? 2 : 1;
    const reviewStepIndex = includesTypeStep ? 3 : 2;
    const stepTitles = includesTypeStep
      ? [tr("Quiz Type", "クイズ種類"), tr("Books", "ブック"), tr("Chapters", "章"), tr("Review", "確認")]
      : [tr("Books", "ブック"), tr("Chapters", "章"), tr("Review", "確認")];
    const isAtTypeStep = quizSetupStep === typeStepIndex;
    const isAtBooksStep = quizSetupStep === booksStepIndex;
    const isAtChaptersStep = quizSetupStep === chaptersStepIndex;
    const isAtReviewStep = quizSetupStep === reviewStepIndex;
    const canMoveForward =
      (isAtTypeStep && includesTypeStep) ||
      (isAtBooksStep && selectedBookCount > 0) ||
      (isAtChaptersStep && selectedChapterCount > 0);
    const nextStepHint =
      isAtBooksStep && selectedBookCount === 0
        ? tr("Select at least one book to continue.", "続行するには1冊以上選択してください。")
        : isAtChaptersStep && selectedChapterCount === 0
          ? tr("Select at least one chapter to continue.", "続行するには1章以上選択してください。")
            : "";

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button
            className="backBtn"
            aria-label={tr("Go back", "\u623b\u308b")}
            onClick={() => setScreen(quizBackScreen === "quizSelect" ? "dashboard" : quizBackScreen)}
          >
            &times;
          </button>
          <h1>{tr("Quiz Setup", "クイズ設定")}</h1>
        </div>
        <p className="quizSetupIntro">
          {tr("Build your quiz in simple steps.", "ステップに沿ってクイズを作成します。")}
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
            <span>{tr("Step 1. Quiz Type", "ステップ1. クイズ種類")}</span>
              <div className="quizSetupQuickActions">
                <button
                  type="button"
                  className={`quizSetupActionBtn ${isQuickQuizSetupArmed ? "isActive" : ""}`}
                  onClick={applyQuickQuizSetup}
                  disabled={!lastQuizSetup}
                >
                  {lastQuizSetup ? tr("Quick Setup", "前回設定を適用") : tr("No Last Setup", "前回設定なし")}
                </button>
              </div>
            </div>
            <div className="quizModeCardGrid" role="group" aria-label={tr("Select quiz type", "クイズ種類を選択")}>
              <button
                type="button"
                className={`quizModeCard ${quizMode === "normal" ? "isActive" : ""}`}
                onClick={() => setQuizMode("normal")}
              >
                <span className="quizModeCardIcon" aria-hidden="true">{"\uD83C\uDFAF"}</span>
                <strong>{tr("Multiple Choice", "選択式")}</strong>
                <small>
                  {tr("Pick the correct answer from options.", "選択肢から正解を選びます。")}
                  <br />
                  {tr("Strengthens: comprehension, quick recognition, and definition recall.", "理解力・認識速度・意味想起を強化します。")}
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
                <strong>{tr("Typing", "タイピング")}</strong>
                <small>
                  {tr("Type the exact target word.", "正確な単語を入力します。")}
                  <br />
                  {tr("Strengthens: spelling precision, active recall, and improved essay writing.", "綴り精度・能動想起・作文力を強化します。")}
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
                <strong>{tr("Mistake Review", "ミス復習")}</strong>
                <small>{tr("Practice only words you previously got wrong.", "以前間違えた単語だけを練習します。")}</small>
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
                <strong>{tr("Smart Review", "スマート復習")}</strong>
                <small>
                  {tr("Auto-build a focused quiz from weak words based on your recent accuracy.", "最近の正答率から弱点単語で自動構成します。")}
                </small>
              </button>
            </div>
          </div>
        )}
        {isAtBooksStep && (
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{includesTypeStep ? tr("Step 2. Books", "ステップ2. ブック") : tr("Step 1. Books", "ステップ1. ブック")}</span>
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
                {tr("Select all", "すべて選択")}
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
                {tr("Clear", "クリア")}
              </button>
            </div>
          </div>
          <div className="quizChapterPills" role="group" aria-label={tr("Select books", "ブックを選択")}>
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
          {books.length === 0 && <p className="quizSetupHint">{tr("No books available yet.", "利用可能なブックがありません。")}</p>}
          {selectedBookCount === 0 && (
            <p className="quizSetupHint">{tr("Select at least one book to see chapters.", "章を表示するには1冊以上選択してください。")}</p>
          )}
        </div>
        )}
        {isAtChaptersStep && (
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{includesTypeStep ? tr("Step 3. Chapters", "ステップ3. 章") : tr("Step 2. Chapters", "ステップ2. 章")}</span>
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
                {tr("Select all", "すべて選択")}
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
                {tr("Clear", "クリア")}
              </button>
            </div>
          </div>
          <div className="quizChapterGroups" role="group" aria-label={tr("Select chapters by book", "ブックごとに章を選択")}>
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
                    {tr("Select all", "すべて選択")}
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
            <p className="quizSetupHint">{tr("No chapters found for the selected books.", "選択したブックに章がありません。")}</p>
          )}
          {selectedBookCount > 0 && quizSetupChapterGroups.length > 0 && selectedChapterCount === 0 && (
            <p className="quizSetupHint">{tr("Select at least one chapter.", "1章以上選択してください。")}</p>
          )}
        </div>
        )}
        {isAtReviewStep && (
          <div className="quizSetupReviewCard">
            <h3>{tr("Review & Start", "確認して開始")}</h3>
            <div className="quizSetupSummary">
              <span>{tr("Mode", "モード")}: {quizMode === "typing" ? tr("Typing", "タイピング") : quizMode === "mistake" ? tr("Mistake Review", "ミス復習") : quizMode === "smart" ? tr("Smart Review", "スマート復習") : tr("Multiple Choice", "選択式")}</span>
              <span>{tr("Books", "ブック")}: {selectedBookCount}</span>
              <span>{tr("Chapters", "章")}: {selectedChapterCount}</span>
              <span>{tr("Matching words", "対象単語")}: {quizSetupWords.length}</span>
            </div>
          </div>
        )}
        {quizMode === "mistake" && !hasPreviousQuizMistakes && (
          <p className="quizSetupHint">
            {tr("No previous quiz mistakes found yet. Complete a regular quiz first.", "前回までのミスがありません。先に通常クイズを完了してください。")}
          </p>
        )}
        {!canStartQuiz && isAtReviewStep && (
          <p className="quizSetupHint">
            {tr("Select at least one book and chapter with at least 2 matching words.", "2語以上含むブックと章を選択してください。")}
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
              {tr("Back", "戻る")}
            </button>
            {isAtReviewStep ? (
              <button
                type="button"
                className="primaryBtn"
                disabled={!canStartQuiz}
                onClick={startQuizSession}
              >
                {tr("Start", "開始")} {quizMode === "typing" ? tr("Typing Quiz", "タイピングクイズ") : quizMode === "mistake" ? tr("Mistake Review", "ミス復習") : quizMode === "smart" ? tr("Smart Review", "スマート復習") : tr("Quiz", "クイズ")}
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
                      tr("Your last quiz setup no longer matches available books/chapters. Please update setup and try again.", "前回の設定が現在のブック/章と一致しません。更新して再試行してください。"),
                      tr("Quick Setup Unavailable", "前回設定を適用できません")
                    );
                    return;
                  }
                  setQuizSetupStep((prev) => Math.min(reviewStepIndex, prev + 1));
                }}
              >
                {tr("Next", "次へ")}
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
        locale={appLocale}
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
        onQuestionCompleted={recordQuizQuestionCompleted}
        onRecordMistake={recordMistakeForWord}
        onResolveMistake={resolveMistakeForWord}
        onQuizComplete={handleQuizComplete}
        onStartMistakeReview={() => requestMistakeReview(quizBackScreen === "bookMenu" ? "book" : "global")}
        onTryAgain={handleQuizTryAgain}
        buildQuizQuestions={buildQuizQuestions}
        isEquivalentTypingAnswer={isEquivalentTypingAnswer}
        DEFAULT_CHAPTER_ID={DEFAULT_CHAPTER_ID}
        QUIZ_SUCCESS_PROMPTS={isJapaneseUi ? QUIZ_SUCCESS_PROMPTS_JA : QUIZ_SUCCESS_PROMPTS}
        QUIZ_MISS_PROMPTS={isJapaneseUi ? QUIZ_MISS_PROMPTS_JA : QUIZ_MISS_PROMPTS}
        locale={appLocale}
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
        onQuestionCompleted={recordQuizQuestionCompleted}
        onRecordMistake={recordMistakeForWord}
        onResolveMistake={resolveMistakeForWord}
        onQuizComplete={handleQuizComplete}
        onStartMistakeReview={() => requestMistakeReview(quizBackScreen === "bookMenu" ? "book" : "global")}
        onTryAgain={handleQuizTryAgain}
        buildQuizQuestions={buildQuizQuestions}
        isEquivalentTypingAnswer={isEquivalentTypingAnswer}
        DEFAULT_CHAPTER_ID={DEFAULT_CHAPTER_ID}
        QUIZ_SUCCESS_PROMPTS={isJapaneseUi ? QUIZ_SUCCESS_PROMPTS_JA : QUIZ_SUCCESS_PROMPTS}
        QUIZ_MISS_PROMPTS={isJapaneseUi ? QUIZ_MISS_PROMPTS_JA : QUIZ_MISS_PROMPTS}
        locale={appLocale}
      />
    );
  }

  return null;
}







