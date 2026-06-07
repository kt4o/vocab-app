import { useState, useEffect, useRef, useCallback } from "react";
import { Flashcards } from "./components/Flashcards";
import { Quiz } from "./components/Quiz";
import { AdaptiveReviewSession } from "./components/AdaptiveReviewSession";
import { JapaneseWordDisplay } from "./components/JapaneseWordDisplay";
import { PREMIUM_UPGRADE_ENABLED } from "./config/premium";
import { identifyAnalyticsUser, resetAnalyticsIdentity, trackEvent } from "./lib/analytics.js";
import { kanaToRomaji } from "./lib/japaneseText";
import { useThemeMode } from "./hooks/useThemeMode.js";

const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000;
const PRO_DAILY_GOAL_DEFAULT = 30;
const PRO_DAILY_GOAL_MIN = 10;
const PRO_DAILY_GOAL_MAX = 120;
const PRO_DAILY_GOAL_STEP = 5;
const FREE_WORD_LIMIT = 100;
const WEAK_WORDS_RECENT_DAY_WINDOW = 21;
const WEAK_WORDS_RECENT_QUESTION_WINDOW = 120;
const DEFAULT_CHAPTER_ID = "general";
const DEFAULT_BOOK_LANGUAGE_MODE = "en_en";
const BOOK_LANGUAGE_MODE_OPTIONS = [
  {
    value: "en_en",
    label: "English to English",
    shortLabel: "EN -> EN",
    sourceLabel: "English",
    targetLabel: "English",
    addWordPlaceholder: "Add English word...",
    attribution: "Definition data is fetched through the backend with Free Dictionary API (dictionaryapi.dev) plus fallback sources and caching for reliability.",
    emptyHint: "Add a word above and Vocalibry will fetch the definition, place it in this chapter, and make it available for flashcards and quizzes.",
  },
  {
    value: "en_ja",
    label: "English to Japanese",
    shortLabel: "EN -> JA",
    sourceLabel: "English",
    targetLabel: "Japanese",
    addWordPlaceholder: "Add English word...",
    attribution: "Translation data is fetched from Jisho (jisho.org) for English-to-Japanese learning.",
    emptyHint: "Add an English word above and Vocalibry will fetch Japanese meanings for this book's flashcards and quizzes.",
  },
  {
    value: "ja_en",
    label: "Japanese to English",
    shortLabel: "JA -> EN",
    sourceLabel: "Japanese",
    targetLabel: "English",
    addWordPlaceholder: "Add Japanese word or romaji...",
    attribution: "Translation data is fetched from Jisho (jisho.org) for Japanese-to-English learning.",
    emptyHint: "Add a Japanese word or romaji above and Vocalibry will fetch English meanings for this book's flashcards and quizzes.",
  },
];
const BOOK_LANGUAGE_MODE_VALUE_SET = new Set(BOOK_LANGUAGE_MODE_OPTIONS.map((option) => option.value));
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;
const STATE_API_PATH = `${API_BASE_URL}/api/state`;
const BILLING_API_PATH = `${API_BASE_URL}/api/billing`;
const ANALYTICS_API_PATH = `${API_BASE_URL}/api/analytics`;
const TRANSLATION_API_PATH = `${API_BASE_URL}/api/translate`;
const DEFINITION_API_PATH = `${API_BASE_URL}/api/define`;
const EXAMPLE_API_PATH = `${API_BASE_URL}/api/examples`;
const REVIEW_API_PATH = `${API_BASE_URL}/api/review`;
const CLOUD_STATE_SYNC_DEBOUNCE_MS = 900;
const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";
const AUTH_USERNAME_STORAGE_KEY = "vocab_auth_username";
const LOCAL_STATE_UPDATED_AT_STORAGE_KEY = "vocab_local_state_updated_at";
const ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY = "vocab_onboarding_tutorial_pending";
const ONBOARDING_TUTORIAL_SEEN_PREFIX = "vocab_onboarding_tutorial_seen";
const SIGNUP_USERNAME_MESSAGE =
  "Username must be 3-24 characters: lowercase letters, numbers, or underscores only. Spaces become underscores.";
const SIGNUP_PASSWORD_MESSAGE =
  "Password must be 3-24 characters: English letters, numbers, or symbols only. No spaces or non-English characters.";
const JAPANESE_LEARNER_MODE_STORAGE_KEY = "vocab_japanese_learner_mode";
const UI_LANGUAGE_STORAGE_KEY = "vocab_ui_language";
const DICTIONARY_PREFERENCE_STORAGE_KEY = "vocab_dictionary_preference";
const COOKIE_SESSION_AUTH_MARKER = "__cookie_session__";
const LEGAL_VERSION = "2026-04-08";
const RETENTION_PING_DAY_KEY_STORAGE = "vocab_retention_ping_day";
const API_FETCH_TIMEOUT_MS = 12000;
const API_FETCH_RETRY_DELAYS_MS = [400, 1000];
const VOCABULARY_INPUT_MAX_WORDS = 3;
const VOCABULARY_INPUT_MAX_LENGTH = 64;
const SENTENCE_PUNCTUATION_PATTERN = /[.!?,;:。！？、；：]/;

function normalizeVocabularyInput(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isShortVocabularyItem(value, { allowJapanese = false } = {}) {
  const input = normalizeVocabularyInput(value);
  if (!input || input.length > VOCABULARY_INPUT_MAX_LENGTH) return false;
  if (SENTENCE_PUNCTUATION_PATTERN.test(input)) return false;

  const spaceSeparatedParts = input.split(" ").filter(Boolean);
  if (spaceSeparatedParts.length > VOCABULARY_INPUT_MAX_WORDS) return false;

  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(input);
  if (hasJapanese) {
    if (!allowJapanese) return false;
    return /^[\u3040-\u30ff\u3400-\u9fffー々〆ヶ・\s-]+$/.test(input);
  }

  return /^[a-z][a-z0-9' -]{1,63}$/i.test(input);
}

function hasJapaneseVocabularyCharacters(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
}

function hasEnglishVocabularyCharacters(value) {
  return /[a-z]/i.test(String(value || ""));
}

function normalizeResolvedJapaneseWord(value) {
  return String(value || "")
    .split(/\s*[/／,，、]\s*/)
    .map((part) => part.trim())
    .find((part) => hasJapaneseVocabularyCharacters(part)) || "";
}

function isRomanizedJapaneseVocabularyInput(value) {
  const input = normalizeVocabularyInput(value);
  if (!input || hasJapaneseVocabularyCharacters(input)) return false;
  return /^[a-z][a-z0-9' -]{1,63}$/i.test(input);
}

function getAdaptiveReviewItemKey(item) {
  return [item?.bookId || "", item?.chapterId || "", item?.word || ""].join("\u001f");
}

function parseTimestampMs(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function countStoredWords(rawBooks) {
  const books = Array.isArray(rawBooks) ? rawBooks : [];
  return books.reduce((total, book) => {
    const words = Array.isArray(book?.words) ? book.words : [];
    return total + words.length;
  }, 0);
}

function buildLocalAdaptiveReviewSummaries(rawBooks) {
  const books = Array.isArray(rawBooks) ? rawBooks : [];
  return books
    .map((book) => {
      const bookId = String(book?.id || "").trim();
      const words = Array.isArray(book?.words) ? book.words.filter((wordEntry) => String(wordEntry?.word || "").trim()) : [];
      if (!bookId || words.length === 0) return null;
      return {
        bookId,
        bookName: String(book?.name || "").trim() || "Book",
        totalWords: words.length,
        dueNow: words.length,
        isLocalFallback: true,
      };
    })
    .filter(Boolean);
}

function mergeAdaptiveReviewSummaries(apiSummaries, localSummaries) {
  const merged = new Map();
  (Array.isArray(apiSummaries) ? apiSummaries : []).forEach((summary) => {
    const bookId = String(summary?.bookId || "").trim();
    if (!bookId) return;
    merged.set(bookId, { ...summary, bookId });
  });

  (Array.isArray(localSummaries) ? localSummaries : []).forEach((summary) => {
    const bookId = String(summary?.bookId || "").trim();
    if (!bookId || merged.has(bookId)) return;
    merged.set(bookId, { ...summary, bookId });
  });

  return Array.from(merged.values());
}

function getCloudStateSyncErrorMessage(result, fallbackMessage) {
  const errorCode = String(result?.error || "").trim();
  if (errorCode === "free-word-limit-reached") {
    return `Adaptive Review could not sync because this account is over the ${FREE_WORD_LIMIT}-word Free plan limit.`;
  }
  if (errorCode === "invalid-app-state") {
    return "Adaptive Review could not sync your latest books. Please refresh and try again.";
  }
  return fallbackMessage;
}

const ACCOUNT_DATA_STORAGE_KEYS = [
  "vocab_books",
  "vocab_weekly_stats",
  "vocab_activity_history",
  "vocab_pro_daily_goal_questions",
  "vocab_feature_daily_goals_enabled",
  "vocab_free_daily_usage",
  "vocab_last_quiz_mistakes",
  "vocab_last_quiz_mistakes_by_book",
  "vocab_last_quiz_mistake_mode",
  "vocab_last_quiz_mistake_mode_by_book",
  "vocab_last_quiz_setup",
  "vocab_streak",
  LOCAL_STATE_UPDATED_AT_STORAGE_KEY,
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
    invalidEnglishWord: "Please enter one word or a short compound word.",
    invalidEnglishWordTitle: "Invalid word",
    wrongLanguageEnglishWord: "Please enter a word in English.",
    wrongLanguageJapaneseWord: "Please enter a word in Japanese.",
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
    invalidEnglishWord: "1つの単語、または短い複合語を入力してください。",
    invalidEnglishWordTitle: "無効な単語",
    wrongLanguageEnglishWord: "英語の単語を入力してください。",
    wrongLanguageJapaneseWord: "日本語の単語を入力してください。",
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
function isBearerAuthToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function isValidSignupPassword(value) {
  return /^[\x21-\x7E]{3,24}$/.test(String(value || ""));
}

function isValidSignupUsername(value) {
  return /^[a-z0-9_]{3,24}$/.test(String(value || ""));
}

function formatUsernameInput(value) {
  return String(value || "").replace(/ /g, "_");
}

function buildAuthHeaders(authToken, baseHeaders = {}) {
  const headers = { ...(baseHeaders || {}) };
  if (isBearerAuthToken(authToken)) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isTransientHttpStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function isAbortLikeError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "AbortError" || message.includes("aborted") || message.includes("abort");
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || API_FETCH_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const fetchOptions = { ...options };
  const signal = fetchOptions.signal;
  delete fetchOptions.timeoutMs;
  delete fetchOptions.signal;

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url, options = {}) {
  const retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : API_FETCH_RETRY_DELAYS_MS;
  const fetchOptions = { ...options };
  delete fetchOptions.retryDelays;
  let lastError;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions);
      if (!isTransientHttpStatus(response.status) || attempt >= retryDelays.length) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= retryDelays.length) {
        throw error;
      }
    }

    await wait(retryDelays[attempt]);
  }

  throw lastError || new Error("Network request failed.");
}

function navigateTo(path) {
  const nextPath = String(path || "/").trim() || "/";
  window.history.replaceState(null, "", nextPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
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

function inferBookLanguageMode(book) {
  const explicitMode = parseBookLanguageMode(book?.languageMode, "");
  if (explicitMode) return explicitMode;

  const words = Array.isArray(book?.words) ? book.words : [];
  const hasJapaneseTranslationWords = words.some((wordEntry) => {
    const meaningSource = String(wordEntry?.meaningSource || "").trim().toLowerCase();
    const translationProvider = String(wordEntry?.translationProvider || "").trim();
    return meaningSource === "translator_en_ja" || Boolean(translationProvider);
  });

  return hasJapaneseTranslationWords ? "en_ja" : DEFAULT_BOOK_LANGUAGE_MODE;
}

function getMistakeCount(wordEntry) {
  const count = Number(wordEntry?.mistakeCount ?? 0);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

function extractDictionaryApiDefinitions(payload) {
  const rows = Array.isArray(payload) ? payload : [];
  const seen = new Set();
  const definitions = [];

  rows.forEach((entry) => {
    const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    meanings.forEach((meaning) => {
      const items = Array.isArray(meaning?.definitions) ? meaning.definitions : [];
      items.forEach((item) => {
        const text = String(item?.definition || "").trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) return;
        seen.add(key);
        definitions.push(text);
      });
    });
  });

  return definitions.slice(0, 12);
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
  const definitions = [];

  rows.forEach((item) => {
    const rows = Array.isArray(item?.defs) ? item.defs : [];
    rows.forEach((definitionRow) => {
      const raw = String(definitionRow || "").trim();
      const text = raw.includes("\t") ? raw.split("\t").slice(1).join("\t").trim() : raw;
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      definitions.push(text);
    });
  });

  return definitions.slice(0, 12);
}

async function fetchEnglishDefinitionsDirect(word) {
  let sawDictionaryNotFound = false;

  try {
    const dictionaryResponse = await fetchWithRetry(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        headers: { Accept: "application/json" },
        timeoutMs: 9000,
        retryDelays: [500],
      }
    );
    if (dictionaryResponse.ok) {
      const payload = await dictionaryResponse.json().catch(() => null);
      const definitions = extractDictionaryApiDefinitions(payload);
      if (definitions.length) {
        return {
          definitions,
          pronunciation: extractDictionaryApiPronunciation(payload),
          provider: "dictionaryapi-direct",
          error: "",
        };
      }
    }
    if (dictionaryResponse.status === 404) {
      sawDictionaryNotFound = true;
    }
  } catch {
    // Try Datamuse below before surfacing a provider failure.
  }

  try {
    const datamuseResponse = await fetchWithRetry(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=6`,
      {
        headers: { Accept: "application/json" },
        timeoutMs: 9000,
        retryDelays: [500],
      }
    );
    if (datamuseResponse.ok) {
      const payload = await datamuseResponse.json().catch(() => null);
      const definitions = extractDatamuseDefinitions(payload);
      if (definitions.length) {
        return {
          definitions,
          pronunciation: "",
          provider: "datamuse-direct",
          error: "",
        };
      }
    }
  } catch {
    // Fall through to the network error response below.
  }

  return {
    definitions: [],
    pronunciation: "",
    provider: "direct",
    error: sawDictionaryNotFound ? "definition-not-found" : "definition-provider-failed",
  };
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
      const res = await fetchWithRetry(normalizedEndpoint, {
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

  const directResult = await fetchEnglishDefinitionsDirect(input);
  if (directResult.definitions.length > 0) return directResult;
  if (directResult.error === "definition-not-found") return directResult;

  return {
    definitions: [],
    pronunciation: "",
    provider: directResult.provider || "backend",
    error: lastErrorCode || directResult.error || "definition-request-failed",
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
    return (japanese.length ? japanese : cleaned).slice(0, 1);
  };

  const normalizeEnglishLookupText = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9' -]+/g, " ")
      .replace(/\s+/g, " ");

  const getSenseMatchScore = (sense) => {
    const normalizedInput = normalizeEnglishLookupText(input);
    if (!normalizedInput) return 0;
    const definitions = Array.isArray(sense?.english_definitions) ? sense.english_definitions : [];
    return definitions.reduce((bestScore, definition) => {
      const normalizedDefinition = normalizeEnglishLookupText(definition);
      if (normalizedDefinition === normalizedInput) return Math.max(bestScore, 3);
      if (normalizedDefinition.startsWith(`${normalizedInput} `)) return Math.max(bestScore, 2);
      if (normalizedDefinition.includes(` ${normalizedInput} `)) return Math.max(bestScore, 1);
      return bestScore;
    }, 0);
  };

  const fetchJishoDirect = async () => {
    if (!isJishoCompatibleInput(input)) {
      return { translations: [], provider: "jisho-direct", error: "jisho-word-not-available" };
    }

    try {
      const res = await fetchWithRetry(
        `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(input)}`,
        {
          headers: {
            Accept: "application/json",
          },
          timeoutMs: 9000,
          retryDelays: [500],
        }
      );
      if (!res.ok) {
        return { translations: [], provider: "jisho-direct", error: "translation-provider-failed" };
      }

      const payload = await res.json().catch(() => null);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const candidates = [];
      const seen = new Set();
      const rankedItems = items.slice(0, 12).map((item, itemIndex) => {
        const senses = Array.isArray(item?.senses) ? item.senses : [];
        const senseMatchScore = senses.reduce(
          (bestScore, sense) => Math.max(bestScore, getSenseMatchScore(sense)),
          0
        );
        return { item, itemIndex, senseMatchScore };
      });
      const hasSenseMatches = rankedItems.some((entry) => entry.senseMatchScore > 0);
      const sourceItems = hasSenseMatches
        ? rankedItems.filter((entry) => entry.senseMatchScore > 0)
        : rankedItems.filter((entry) => Boolean(entry.item?.is_common));
      const selectedItems = [...(sourceItems.length ? sourceItems : rankedItems)].sort(
        (a, b) =>
          b.senseMatchScore - a.senseMatchScore ||
          Number(Boolean(b.item?.is_common)) - Number(Boolean(a.item?.is_common)) ||
          a.itemIndex - b.itemIndex
      );

      selectedItems.forEach(({ item }) => {
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
      const res = await fetchWithRetry(normalizedEndpoint, {
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
            confidence: String(payload?.confidence || "").trim().toLowerCase(),
            partOfSpeech: String(payload?.partOfSpeech || "").trim(),
            note: String(payload?.note || "").trim(),
            reading: String(payload?.reading || "").trim(),
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
      if (errorCode === "invalid-vocabulary-item") {
        return { translations: [], provider: "backend", error: errorCode };
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

async function fetchJapaneseToEnglishTranslations(word) {
  const input = String(word || "").trim();
  if (!input) return { translations: [], provider: "", error: "" };
  const hasJapanese = (value) => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
  const isJishoCompatibleRomajiInput = (value) => /^[a-z][a-z0-9' -]{1,63}$/i.test(String(value || "").trim());

  const normalize = (values) => {
    const seen = new Set();
    return values
      .map((value) => String(value || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 1);
  };

  const normalizeJapaneseLookupText = (value) =>
    String(value || "")
      .replace(/\s+/g, "")
      .trim();

  const getJapaneseEntryMatchScore = (item) => {
    const normalizedInput = normalizeJapaneseLookupText(input);
    if (!normalizedInput) return 0;
    const japaneseList = Array.isArray(item?.japanese) ? item.japanese : [];
    return japaneseList.reduce((bestScore, jpEntry) => {
      const word = normalizeJapaneseLookupText(jpEntry?.word);
      const reading = normalizeJapaneseLookupText(jpEntry?.reading);
      if (word && word === normalizedInput) return Math.max(bestScore, 4);
      if (reading && reading === normalizedInput) return Math.max(bestScore, 3);
      return bestScore;
    }, 0);
  };

  const getPrimaryJapaneseEntry = (item) => {
    const japaneseList = Array.isArray(item?.japanese) ? item.japanese : [];
    const exactEntry = japaneseList.find((jpEntry) => {
      const word = normalizeJapaneseLookupText(jpEntry?.word);
      const reading = normalizeJapaneseLookupText(jpEntry?.reading);
      const normalizedInput = normalizeJapaneseLookupText(input);
      return normalizedInput && (word === normalizedInput || reading === normalizedInput);
    });
    const primaryEntry = exactEntry || japaneseList.find((jpEntry) => jpEntry?.word || jpEntry?.reading);
    const resolvedWord = normalizeResolvedJapaneseWord(primaryEntry?.word || primaryEntry?.reading);
    const reading = normalizeResolvedJapaneseWord(primaryEntry?.reading);
    return { resolvedWord, reading };
  };

  const isLowValueJishoSense = (sense) => {
    const parts = Array.isArray(sense?.parts_of_speech) ? sense.parts_of_speech : [];
    const tags = Array.isArray(sense?.tags) ? sense.tags : [];
    const definitions = Array.isArray(sense?.english_definitions) ? sense.english_definitions : [];
    const searchable = [...parts, ...tags, ...definitions].join(" ").toLowerCase();
    return /\b(wikipedia definition|surname|given name|family name|place name|company name|organization name|product name|unclassified name|person name|archaism|obsolete term)\b/.test(searchable);
  };

  const fetchJishoDirect = async () => {
    if (!hasJapanese(input) && !isJishoCompatibleRomajiInput(input)) {
      return { translations: [], provider: "jisho-direct", error: "jisho-word-not-available" };
    }

    try {
      const res = await fetchWithRetry(
        `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(input)}`,
        {
          headers: { Accept: "application/json" },
          timeoutMs: 9000,
          retryDelays: [500],
        }
      );
      if (!res.ok) {
        return { translations: [], provider: "jisho-direct", error: "translation-provider-failed" };
      }

      const payload = await res.json().catch(() => null);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const candidates = [];
      const rankedItems = items.slice(0, 12).map((item, itemIndex) => ({
        item,
        itemIndex,
        matchScore: getJapaneseEntryMatchScore(item),
      }));
      const exactItems = rankedItems.filter((entry) => entry.matchScore > 0);
      const commonItems = rankedItems.filter((entry) => Boolean(entry.item?.is_common));
      const selectedItems = [...(exactItems.length ? exactItems : commonItems.length ? commonItems : rankedItems)]
        .sort(
          (a, b) =>
            b.matchScore - a.matchScore ||
            Number(Boolean(b.item?.is_common)) - Number(Boolean(a.item?.is_common)) ||
            a.itemIndex - b.itemIndex
        )
        .slice(0, 4);

      const primaryJapanese = getPrimaryJapaneseEntry(selectedItems[0]?.item);

      selectedItems.forEach(({ item }) => {
        const senses = Array.isArray(item?.senses) ? item.senses : [];
        const usefulSenses = senses.filter((sense) => !isLowValueJishoSense(sense));
        const selectedSenses = usefulSenses.length ? usefulSenses : senses;
        selectedSenses.forEach((sense) => {
          const englishDefinitions = Array.isArray(sense?.english_definitions)
            ? sense.english_definitions
            : [];
          englishDefinitions.forEach((definition) => candidates.push(definition));
        });
      });

      const translations = normalize(candidates);
      if (!translations.length) {
        return { translations: [], provider: "jisho-direct", error: "jisho-word-not-available" };
      }
      return {
        translations,
        provider: "jisho-direct",
        resolvedWord: primaryJapanese.resolvedWord,
        reading: primaryJapanese.reading,
        error: "",
      };
    } catch {
      return { translations: [], provider: "jisho-direct", error: "translation-provider-failed" };
    }
  };

  const endpointCandidates = [`${TRANSLATION_API_PATH}/ja-en`];
  const onLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!API_BASE_URL && onLocalhost) {
    endpointCandidates.push("http://localhost:4000/api/translate/ja-en");
  }

  const triedEndpoints = new Set();
  let sawApiConnectionError = false;

  for (const endpoint of endpointCandidates) {
    const normalizedEndpoint = String(endpoint || "").trim();
    if (!normalizedEndpoint || triedEndpoints.has(normalizedEndpoint)) continue;
    triedEndpoints.add(normalizedEndpoint);

    try {
      const res = await fetchWithRetry(normalizedEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        const normalized = normalize(Array.isArray(payload?.translations) ? payload.translations : []);
        if (normalized.length) {
          return {
            translations: normalized,
            provider: String(payload?.provider || "backend").trim().toLowerCase() || "backend",
            resolvedWord: String(payload?.resolvedWord || payload?.sourceText || "").trim(),
            reading: String(payload?.reading || "").trim(),
            confidence: String(payload?.confidence || "").trim().toLowerCase(),
            partOfSpeech: String(payload?.partOfSpeech || "").trim(),
            note: String(payload?.note || "").trim(),
            error: "",
          };
        }
      }

      const errorCode = String(payload?.error || "").trim().toLowerCase();
      if (errorCode === "jisho-word-not-available") {
        return { translations: [], provider: "jisho", error: errorCode };
      }
      if (errorCode === "invalid-vocabulary-item" && !isJishoCompatibleRomajiInput(input)) {
        return { translations: [], provider: "backend", error: errorCode };
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

async function fetchExampleSentence({ word, definitions, languageMode }) {
  const input = String(word || "").trim();
  if (!input) return null;

  const endpointCandidates = [`${EXAMPLE_API_PATH}/sentence`];
  const onLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!API_BASE_URL && onLocalhost) {
    endpointCandidates.push("http://localhost:4000/api/examples/sentence");
  }

  const triedEndpoints = new Set();
  for (const endpoint of endpointCandidates) {
    const normalizedEndpoint = String(endpoint || "").trim();
    if (!normalizedEndpoint || triedEndpoints.has(normalizedEndpoint)) continue;
    triedEndpoints.add(normalizedEndpoint);

    try {
      const res = await fetchWithRetry(normalizedEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: input,
          definitions: Array.isArray(definitions) ? definitions.slice(0, 3) : [],
          languageMode: parseBookLanguageMode(languageMode, DEFAULT_BOOK_LANGUAGE_MODE),
        }),
        timeoutMs: 14000,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) continue;
      const sentence = String(payload?.sentence || "").trim();
      if (!sentence) continue;
      return {
        sentence,
        translation: String(payload?.translation || "").trim(),
        provider: String(payload?.provider || "openai").trim().toLowerCase() || "openai",
      };
    } catch {
      // Example sentences are enrichment; saving the word should still succeed.
    }
  }

  return null;
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
  return normalized === "en_ja" || normalized === "en_en" || normalized === "ja_en"
    ? normalized
    : fallbackValue;
}

function parseBookLanguageMode(value, fallbackValue = DEFAULT_BOOK_LANGUAGE_MODE) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return BOOK_LANGUAGE_MODE_VALUE_SET.has(normalized) ? normalized : fallbackValue;
}

function getBookLanguageModeMeta(mode) {
  const normalized = parseBookLanguageMode(mode);
  return (
    BOOK_LANGUAGE_MODE_OPTIONS.find((option) => option.value === normalized) ||
    BOOK_LANGUAGE_MODE_OPTIONS[0]
  );
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
  const mode = normalizeQuizMode(parsed.mode, "normal");

  if (bookIds.length === 0 || chapterKeys.length === 0) return null;

  return {
    mode,
    bookIds,
    chapterKeys,
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
          const performance = getWordQuizPerformanceStats(wordEntry?.quizPerformanceHistory);
          const recentAccuracyPenalty = performance.attempts
            ? (100 - (performance.accuracyPercent || 0)) / 10
            : 0;
          const recentAttemptSignal = Math.min(
            performance.attempts,
            WEAK_WORDS_RECENT_QUESTION_WINDOW
          ) * 0.12;
          const weaknessScore =
            mistakeCount * 4 +
            recentAccuracyPenalty * 3 +
            recentAttemptSignal;

          return {
            ...wordEntry,
            sourceBookId: book.id,
            sourceBookName: String(book?.name || "Book"),
            mistakeCount,
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
        japaneseReading: entry.japaneseReading || entry.reading || entry.pronunciation || "",
        japaneseRomaji: entry.japaneseRomaji || "",
        correctDefinition,
        options,
        sourceBookId: entry.sourceBookId ?? null,
        languageMode: parseBookLanguageMode(entry?.languageMode, DEFAULT_BOOK_LANGUAGE_MODE),
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
  const languageMode = inferBookLanguageMode(book);
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
    const japaneseReading = String(
      wordEntry?.japaneseReading ||
        wordEntry?.reading ||
        wordEntry?.pronunciation ||
        wordEntry?.pronounciation ||
        ""
    ).trim();
    return {
      ...wordEntry,
      languageMode: parseBookLanguageMode(wordEntry?.languageMode, languageMode),
      chapterId: safeChapterId,
      japaneseReading,
      japaneseRomaji: String(wordEntry?.japaneseRomaji || (japaneseReading ? kanaToRomaji(japaneseReading) : "")).trim(),
      exampleSentence: String(wordEntry?.exampleSentence || "").trim(),
      exampleTranslation: String(wordEntry?.exampleTranslation || "").trim(),
      exampleProvider: String(wordEntry?.exampleProvider || "").trim().toLowerCase(),
      quizPerformanceHistory: sanitizeWordQuizPerformanceHistory(wordEntry?.quizPerformanceHistory),
    };
  });

  return {
    ...book,
    languageMode,
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
  const allowed = new Set(["normal", "typing", "mistake"]);
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

const ONBOARDING_TUTORIAL_SLIDES = [
  {
    title: "Welcome to Vocalibry",
    body: "Here is the quick path: create a book, add words, review them, then track what is improving.",
    type: "welcome",
    highlights: ["📚 Create books", "📝 Add words", "⚡ Practice recall", "📊 Track progress"],
  },
  {
    title: "Create your first book",
    body: "Start by making a focused book and choose its language mode, like English vocabulary or Japanese practice.",
    image: "/landing/tutorial-1-create-book.png",
    alt: "My Books screen showing the create your first vocabulary book prompt",
  },
  {
    title: "Add words and chapters",
    body: "Add words in the book's chosen direction, then use chapters to keep each unit or section organized.",
    image: "/landing/tutorial-2-add-words.png",
    alt: "Book definitions screen showing a word list and chapter controls",
  },
  {
    title: "Review with practice modes",
    body: "Use flashcards, quizzes, typing practice, and smart review to build recall.",
    image: "/landing/tutorial-3-review.png",
    alt: "Quiz screen showing vocabulary review choices",
  },
  {
    title: "Analyze your learning",
    body: "Check your data to see words added, questions completed, and time studied.",
    image: "/landing/tutorial-4-data.png",
    alt: "Data screen showing learning progress charts and summary stats",
  },
];

function getOnboardingSeenStorageKey(username) {
  const safeUsername = String(username || "account").trim().toLowerCase() || "account";
  return `${ONBOARDING_TUTORIAL_SEEN_PREFIX}_${safeUsername}`;
}

function isDevTutorialAccount(username) {
  return String(username || "").trim().toLowerCase() === "dev";
}

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
  const [, setLastAddedWord] = useState("");
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem("vocab_streak");
    return parseStoredStreak(saved);
  });
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookLanguageMode, setNewBookLanguageMode] = useState(() =>
    parseBookLanguageMode(localStorage.getItem(DICTIONARY_PREFERENCE_STORAGE_KEY), DEFAULT_BOOK_LANGUAGE_MODE)
  );
  const [bookPendingRename, setBookPendingRename] = useState(null);
  const [renamedBookName, setRenamedBookName] = useState("");
  const [bookPendingDelete, setBookPendingDelete] = useState(null);
  const [chapterPendingDelete, setChapterPendingDelete] = useState(null);
  const [noticeModal, setNoticeModal] = useState(null);
  const [isOnboardingTutorialOpen, setIsOnboardingTutorialOpen] = useState(false);
  const [isOnboardingCloseConfirmOpen, setIsOnboardingCloseConfirmOpen] = useState(false);
  const [onboardingTutorialStep, setOnboardingTutorialStep] = useState(0);
  const [hasCompletedOnboardingThisSession, setHasCompletedOnboardingThisSession] = useState(false);
  const [guidedTourStep, setGuidedTourStep] = useState("");
  const [isGuidedTourDismissed, setIsGuidedTourDismissed] = useState(false);
  const [quizBackScreen, setQuizBackScreen] = useState("dashboard");
  const [quizMode, setQuizMode] = useState("normal");
  const [quizSetupStep, setQuizSetupStep] = useState(0);
  const [quizSetupSelection, setQuizSetupSelection] = useState({
    bookIds: [],
    chapterKeys: [],
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
  const [isDailyGoalsEnabled, setIsDailyGoalsEnabled] = useState(() =>
    parseStoredBoolean(localStorage.getItem("vocab_feature_daily_goals_enabled"), true)
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
    referralCode: "",
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
  const [accountActionError, setAccountActionError] = useState("");
  const [isPasswordChangeSubmitting, setIsPasswordChangeSubmitting] = useState(false);
  const [isLogoutAllSubmitting, setIsLogoutAllSubmitting] = useState(false);
  const [isDeleteAccountSubmitting, setIsDeleteAccountSubmitting] = useState(false);
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCloudStateHydrated, setIsCloudStateHydrated] = useState(false);
  const [isLocalPersistencePaused, setIsLocalPersistencePaused] = useState(false);
  const [adaptiveReviewItems, setAdaptiveReviewItems] = useState([]);
  const [adaptiveReviewStats, setAdaptiveReviewStats] = useState({ dueNow: 0 });
  const [adaptiveReviewBookSummaries, setAdaptiveReviewBookSummaries] = useState([]);
  const [selectedAdaptiveReviewBookId, setSelectedAdaptiveReviewBookId] = useState("");
  const [adaptiveReviewBackScreen, setAdaptiveReviewBackScreen] = useState("adaptiveReviewSelect");
  const [adaptiveReviewLoading, setAdaptiveReviewLoading] = useState(false);
  const [adaptiveReviewError, setAdaptiveReviewError] = useState("");
  const [adaptiveReviewPendingRating, setAdaptiveReviewPendingRating] = useState("");
  const isJapaneseUi = preferredLanguage === "ja";
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
  const adaptiveReviewRatingInFlightRef = useRef(new Set());
  const latestBooksRef = useRef([]);
  const cloudStateSnapshotRef = useRef(null);
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
  const currentBookLanguageMode = parseBookLanguageMode(currentBook?.languageMode, DEFAULT_BOOK_LANGUAGE_MODE);
  const currentBookLanguageModeMeta = getBookLanguageModeMeta(currentBookLanguageMode);
  const useEnglishToJapaneseDictionary = currentBookLanguageMode === "en_ja";
  const useJapaneseToEnglishDictionary = currentBookLanguageMode === "ja_en";
  const currentBookWordCount = (currentBook?.words || []).length;
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
  const isAccountDataHydrating = Boolean(authToken) && !isCloudStateHydrated;
  const isProPlan = billingPlan === "pro";
  const totalSavedWordCount = countStoredWords(books);
  const freeWordLimitRemaining = Math.max(0, FREE_WORD_LIMIT - totalSavedWordCount);
  const isFreeWordLimitReached = !isProPlan && totalSavedWordCount >= FREE_WORD_LIMIT;
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
  latestBooksRef.current = books;
  cloudStateSnapshotRef.current = {
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
      isDailyGoalsEnabled,
      preferredLanguage,
      dictionaryPreference,
      lastQuizMistakeKeys,
      lastQuizMistakeKeysByBook,
      lastQuizMistakeMode,
      lastQuizMistakeModeByBook,
      lastQuizSetup,
    },
  };
  const quizSetupBooks = books.filter((book) => quizSetupSelection.bookIds.includes(String(book.id)));
  const lastQuizMistakeKeySet = new Set(lastQuizMistakeKeys);
  function getQuizWordsForSetup(selection, mode) {
    const selectedBookIds = new Set((selection?.bookIds || []).map(String));
    const selectedChapterKeys = new Set(selection?.chapterKeys || []);
    return books.filter((book) => selectedBookIds.has(String(book.id))).flatMap((book) =>
      (book.words || [])
      .filter((wordEntry) => {
        const chapterKey = `${book.id}:${wordEntry.chapterId}`;
        if (!selectedChapterKeys.has(chapterKey)) return false;

        if (mode === "mistake") {
          const mistakeKey = getWordSessionKey(book.id, wordEntry.chapterId, wordEntry.word);
          return lastQuizMistakeKeySet.has(mistakeKey);
        }

        return true;
      })
      .map((wordEntry) => ({
        ...wordEntry,
        sourceBookId: book.id,
        languageMode: parseBookLanguageMode(wordEntry?.languageMode, book.languageMode),
      }))
    );
  }

  const quizSetupWords = getQuizWordsForSetup(quizSetupSelection, quizMode);

  function buildAllBooksQuizSelection(bookCandidates = books) {
    const eligibleBooks = bookCandidates.filter((book) => (book.words || []).length > 0);
    return {
      bookIds: eligibleBooks.map((book) => String(book.id)),
      chapterKeys: eligibleBooks.flatMap((book) =>
        getBookChapterList(book).map((chapter) => `${book.id}:${chapter.id}`)
      ),
    };
  }

  function buildLocalAdaptiveReviewItems(bookId, limit = 20) {
    const safeBookId = String(bookId || "").trim();
    const book = latestBooksRef.current.find((item) => String(item?.id) === safeBookId);
    if (!book) return [];

    const chapterNameById = new Map(
      getBookChapterList(book).map((chapter) => [String(chapter.id), chapter.name || "Chapter"])
    );
    const maxItems = Math.max(1, Math.floor(Number(limit) || 20));

    return (Array.isArray(book.words) ? book.words : [])
      .filter((wordEntry) => String(wordEntry?.word || "").trim())
      .slice(0, maxItems)
      .map((wordEntry) => {
        const chapterId = String(wordEntry?.chapterId || DEFAULT_CHAPTER_ID).trim() || DEFAULT_CHAPTER_ID;
        const japaneseReading = String(
          wordEntry?.japaneseReading ||
            wordEntry?.reading ||
            wordEntry?.pronunciation ||
            wordEntry?.pronounciation ||
            ""
        ).trim();
        return {
          bookId: safeBookId,
          bookName: String(book.name || "").trim() || "Book",
          chapterId,
          chapterName: chapterNameById.get(chapterId) || (chapterId === DEFAULT_CHAPTER_ID ? "General" : "Chapter"),
          word: String(wordEntry.word || "").trim(),
          selectedDefinition: getSelectedDefinition(wordEntry),
          pronunciation: String(wordEntry?.pronunciation || wordEntry?.pronounciation || "").trim(),
          japaneseReading,
          japaneseRomaji: String(wordEntry?.japaneseRomaji || (japaneseReading ? kanaToRomaji(japaneseReading) : "")).trim(),
          isLocalFallback: true,
        };
      });
  }

  function startQuizSessionWithSetup(selection, modeOverride = quizMode) {
    const selectedMode = normalizeQuizMode(modeOverride, "normal");
    const nextWords = getQuizWordsForSetup(selection, selectedMode);
    if ((selection?.bookIds || []).length === 0 || (selection?.chapterKeys || []).length === 0 || nextWords.length < 2) {
      openNoticeModal(
        tr("Add at least 2 words before starting a quiz.", "Add at least 2 words before starting a quiz."),
        tr("Quiz Not Ready", "Quiz Not Ready")
      );
      return;
    }

    const nextTitle =
      selection.bookIds.length === 1
        ? books.find((book) => String(book.id) === selection.bookIds[0])?.name || "Quiz"
        : "Multi-Book Quiz";
    const setupSnapshot = {
      mode: selectedMode,
      bookIds: [...selection.bookIds],
      chapterKeys: [...selection.chapterKeys],
    };
    setQuizMode(selectedMode);
    setQuizSetupSelection(setupSnapshot);
    setLastQuizSetup(setupSnapshot);
    setIsQuickQuizSetupArmed(false);
    setActiveQuizWords(nextWords);
    setActiveQuizTitle(nextTitle);
    setActiveQuizMode(selectedMode);
    setActiveQuizIsMistakeReview(false);
    trackEvent("quiz_started", {
      quiz_mode: selectedMode,
      word_count: nextWords.length,
      book_count: selection.bookIds.length,
      chapter_count: selection.chapterKeys.length,
    });
    setScreen("quiz");
  }

  function startQuizSession() {
    startQuizSessionWithSetup(quizSetupSelection, quizMode);
  }

  function startSmartQuiz() {
    const recentBookWithWords = sortedBooksByRecent.find((book) => (book.words || []).length >= 2);
    const selection = buildAllBooksQuizSelection(recentBookWithWords ? [recentBookWithWords] : sortedBooksByRecent);
    startQuizSessionWithSetup(selection, "normal");
  }

  function openQuizSetup() {
    setQuizBackScreen("quizSelect");
    initializeQuizSetupSelection();
    setQuizMode("normal");
    setScreen("quizSelect");
  }

  function exportWeakWordsCsv() {
    if (!weakWordCandidates.length) {
      openNoticeModal("No weak-word data yet. Complete some quizzes first.", "No Data");
      return;
    }

    const header = [
      "word",
      "book",
      "mistakes",
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
  }, [books, currentBookId, lastQuizMistakeKeysByBook, lastQuizMistakeKeys, lastQuizMistakeModeByBook, lastQuizMistakeMode]);

  const requestMistakeReview = useCallback((source = "global") => {
    pendingMistakeReviewSourceRef.current = source;
    startMistakeReviewSession(source);
  }, [startMistakeReviewSession]);

  const handleQuizTryAgain = useCallback(() => true, []);

  const flushCloudStateNow = useCallback(async () => {
    if (!authToken || !isCloudStateHydrated) return { ok: false, skipped: true };
    const appState = cloudStateSnapshotRef.current || buildBackupSnapshot();

    try {
      const response = await fetchWithRetry(STATE_API_PATH, {
        method: "PUT",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          appState,
        }),
      });

      if (response.status === 401) {
        setAuthToken("");
        setAuthUsername("");
        setAuthError("Your session expired. Please log in again.");
        return { ok: false, unauthorized: true };
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return {
          ok: false,
          status: response.status,
          error: String(payload?.error || response.statusText || "cloud-state-save-failed").trim(),
        };
      }

      const payload = await response.json().catch(() => null);
      const updatedAt = String(payload?.updatedAt || "").trim();
      if (updatedAt) {
        localStorage.setItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY, updatedAt);
      }
      cloudStateSnapshotRef.current = appState;

      return { ok: true };
    } catch (error) {
      console.warn("Immediate cloud state sync failed.", error);
      return { ok: false, error };
    }
  }, [authToken, isCloudStateHydrated]);

  const syncBooksForAdaptiveReview = useCallback(async (nextBooks) => {
    if (!authToken || !isCloudStateHydrated || !Array.isArray(nextBooks)) return { ok: false, skipped: true };
    const currentSnapshot = cloudStateSnapshotRef.current || buildBackupSnapshot();
    const currentData =
      currentSnapshot?.data && typeof currentSnapshot.data === "object" && !Array.isArray(currentSnapshot.data)
        ? currentSnapshot.data
        : {};
    const appState = {
      ...currentSnapshot,
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        ...currentData,
        books: nextBooks,
      },
    };

    try {
      const response = await fetchWithRetry(STATE_API_PATH, {
        method: "PUT",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ appState }),
      });

      if (response.status === 401) {
        setAuthToken("");
        setAuthUsername("");
        setAuthError("Your session expired. Please log in again.");
        return { ok: false, unauthorized: true };
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return {
          ok: false,
          status: response.status,
          error: String(payload?.error || response.statusText || "cloud-state-save-failed").trim(),
        };
      }

      const payload = await response.json().catch(() => null);
      const updatedAt = String(payload?.updatedAt || "").trim();
      if (updatedAt) {
        localStorage.setItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY, updatedAt);
      }
      cloudStateSnapshotRef.current = appState;
      return { ok: true };
    } catch (error) {
      console.warn("Adaptive review word sync failed.", error);
      return { ok: false, error };
    }
  }, [authToken, isCloudStateHydrated]);

  const loadAdaptiveReviewSummary = useCallback(async (options = {}) => {
    const showLoading = !options?.silent;

    if (!authToken) {
      const localBookSummaries = buildLocalAdaptiveReviewSummaries(latestBooksRef.current);
      setAdaptiveReviewBookSummaries(localBookSummaries);
      setAdaptiveReviewStats({
        dueNow: localBookSummaries.reduce(
          (total, summary) => total + Math.max(0, Math.floor(Number(summary?.dueNow) || 0)),
          0
        ),
      });
      setAdaptiveReviewError("");
      return { ok: true, localFallback: true, skipped: true };
    }

    if (showLoading) {
      setAdaptiveReviewLoading(true);
    }
    setAdaptiveReviewError("");

    try {
      const syncResult = await syncBooksForAdaptiveReview(latestBooksRef.current);
      if (!syncResult?.ok && !syncResult?.skipped) {
        throw new Error(
          getCloudStateSyncErrorMessage(
            syncResult,
            "Adaptive Review could not sync your latest books. Please try again."
          )
        );
      }
      const response = await fetchWithRetry(`${REVIEW_API_PATH}/summary`, {
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Unable to load adaptive review.";
        throw new Error(errorMessage);
      }

      const rawBookSummaries = Array.isArray(payload?.books) ? payload.books : [];
      const apiBookSummaries = rawBookSummaries.map((summary) => {
        const totalWords = Math.max(0, Math.floor(Number(summary?.totalWords) || 0));
        const rawDueNow = Math.max(0, Math.floor(Number(summary?.dueNow) || 0));
        return { ...summary, totalWords, dueNow: Math.min(rawDueNow, totalWords) };
      });
      const localBookSummaries = buildLocalAdaptiveReviewSummaries(latestBooksRef.current);
      const bookSummaries = mergeAdaptiveReviewSummaries(apiBookSummaries, localBookSummaries);

      setAdaptiveReviewBookSummaries(bookSummaries);
      setAdaptiveReviewStats({
        dueNow: bookSummaries.reduce((total, summary) => total + Math.max(0, Math.floor(Number(summary?.dueNow) || 0)), 0),
      });
      return { ok: true, payload: { ...payload, books: bookSummaries } };
    } catch (error) {
      const localBookSummaries = buildLocalAdaptiveReviewSummaries(latestBooksRef.current);
      if (localBookSummaries.length > 0) {
        setAdaptiveReviewBookSummaries(localBookSummaries);
        setAdaptiveReviewStats({
          dueNow: localBookSummaries.reduce(
            (total, summary) => total + Math.max(0, Math.floor(Number(summary?.dueNow) || 0)),
            0
          ),
        });
        setAdaptiveReviewError("");
        return { ok: true, localFallback: true, error };
      }

      setAdaptiveReviewBookSummaries([]);
      setAdaptiveReviewStats({ dueNow: 0 });
      setAdaptiveReviewError(
        isAbortLikeError(error)
          ? "Adaptive Review took too long to load. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to load adaptive review."
      );
      return { ok: false, error };
    } finally {
      if (showLoading) {
        setAdaptiveReviewLoading(false);
      }
    }
  }, [authToken, syncBooksForAdaptiveReview]);

  const loadAdaptiveReviewQueue = useCallback(async (limit = 20, options = {}) => {
    const showLoading = !options?.silent;
    const bookId = String(options?.bookId ?? selectedAdaptiveReviewBookId ?? "").trim();

    if (!authToken) {
      const fallbackItems = bookId ? buildLocalAdaptiveReviewItems(bookId, limit) : [];
      setAdaptiveReviewItems(fallbackItems);
      setAdaptiveReviewStats({ dueNow: fallbackItems.length });
      setAdaptiveReviewError("");
      setAdaptiveReviewPendingRating("");
      return {
        ok: true,
        localFallback: true,
        skipped: true,
        payload: { items: fallbackItems, stats: { dueNow: fallbackItems.length } },
      };
    }

    if (showLoading) {
      setAdaptiveReviewLoading(true);
    }
    setAdaptiveReviewError("");
    try {
      const syncResult = await syncBooksForAdaptiveReview(latestBooksRef.current);
      if (!syncResult?.ok && !syncResult?.skipped) {
        throw new Error(
          getCloudStateSyncErrorMessage(
            syncResult,
            "Adaptive Review could not sync your latest words. Please try again."
          )
        );
      }
      const params = new URLSearchParams();
      params.set("limit", String(Math.max(1, Math.floor(Number(limit) || 20))));
      if (bookId) {
        params.set("bookId", bookId);
      }
      const response = await fetchWithRetry(`${REVIEW_API_PATH}/due?${params.toString()}`, {
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Unable to load adaptive review.";
        throw new Error(errorMessage);
      }

      const apiItems = Array.isArray(payload?.items) ? payload.items : [];
      const fallbackItems =
        bookId && apiItems.length === 0 ? buildLocalAdaptiveReviewItems(bookId, limit) : [];
      const items = apiItems.length > 0 ? apiItems : fallbackItems;
      const visibleItems = items.filter(
        (item) => !adaptiveReviewRatingInFlightRef.current.has(getAdaptiveReviewItemKey(item))
      );
      const dueNow = Math.max(0, Math.floor(Number(payload?.stats?.dueNow) || 0));
      setAdaptiveReviewItems(visibleItems);
      setAdaptiveReviewStats({
        dueNow: visibleItems.length > 0 ? Math.max(dueNow, visibleItems.length) : 0,
      });
      return { ok: true, payload };
    } catch (error) {
      const fallbackItems = bookId ? buildLocalAdaptiveReviewItems(bookId, limit) : [];
      if (fallbackItems.length > 0) {
        setAdaptiveReviewItems(fallbackItems);
        setAdaptiveReviewStats({ dueNow: fallbackItems.length });
        setAdaptiveReviewError("");
        return { ok: true, localFallback: true, error, payload: { items: fallbackItems, stats: { dueNow: fallbackItems.length } } };
      }

      setAdaptiveReviewItems([]);
      setAdaptiveReviewStats({ dueNow: 0 });
      setAdaptiveReviewError(
        isAbortLikeError(error)
          ? "Adaptive Review took too long to load. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to load adaptive review."
      );
      return { ok: false, error };
    } finally {
      if (showLoading) {
        setAdaptiveReviewLoading(false);
      }
    }
  }, [authToken, selectedAdaptiveReviewBookId, syncBooksForAdaptiveReview]);

  const openAdaptiveReviewSelect = useCallback(async () => {
    setSelectedAdaptiveReviewBookId("");
    setAdaptiveReviewBackScreen("adaptiveReviewSelect");
    setScreen("adaptiveReviewSelect");
    await loadAdaptiveReviewSummary();
  }, [loadAdaptiveReviewSummary]);

  const openAdaptiveReviewSession = useCallback(async (bookId, options = {}) => {
    const safeBookId = String(bookId || "").trim();
    if (!safeBookId) {
      await openAdaptiveReviewSelect();
      return;
    }

    setSelectedAdaptiveReviewBookId(safeBookId);
    setAdaptiveReviewBackScreen(options.backScreen || "adaptiveReviewSelect");
    setScreen("adaptiveReview");
    const result = await loadAdaptiveReviewQueue(20, { bookId: safeBookId });
    if (result?.ok) {
      trackEvent("adaptive_review_started", {
        book_id: safeBookId,
        due_now: Math.max(0, Math.floor(Number(result?.payload?.stats?.dueNow) || 0)),
      });
    }
  }, [loadAdaptiveReviewQueue, openAdaptiveReviewSelect]);

  function openPracticeQuizForBook(bookId) {
    const safeBookId = String(bookId || "").trim();
    const book = books.find((item) => String(item.id) === safeBookId);
    if (!book) return;

    setCurrentBookId(book.id);
    setQuizBackScreen(screen === "bookMenu" ? "bookMenu" : "adaptiveReviewSelect");
    setQuizMode("normal");
    setQuizSetupStep(0);
    setQuizSetupSelection({
      bookIds: [String(book.id)],
      chapterKeys: getBookChapterList(book).map((chapter) => `${book.id}:${chapter.id}`),
    });
    setScreen("quizSelect");
  }

  const rateAdaptiveReviewWord = useCallback(async (rating) => {
    const currentItem = adaptiveReviewItems[0];
    const itemKey = getAdaptiveReviewItemKey(currentItem);
    const isLocalFallbackItem = Boolean(currentItem?.isLocalFallback);
    if (!currentItem || (!authToken && !isLocalFallbackItem) || adaptiveReviewRatingInFlightRef.current.has(itemKey)) return;

    adaptiveReviewRatingInFlightRef.current.add(itemKey);
    setAdaptiveReviewPendingRating(rating);
    const remainingCount = Math.max(0, adaptiveReviewItems.length - 1);
    const shouldReloadQueueAfterSave = adaptiveReviewItems.length <= 1;

    setAdaptiveReviewError("");
    setAdaptiveReviewItems((prev) => {
      const firstItem = prev[0];
      return firstItem && getAdaptiveReviewItemKey(firstItem) === itemKey ? prev.slice(1) : prev;
    });
    setAdaptiveReviewStats((prev) => ({
      dueNow: Math.max(0, (Number(prev?.dueNow) || 0) - 1),
    }));

    try {
      if (!authToken && isLocalFallbackItem) {
        recordQuizQuestionCompleted({
          sourceBookId: currentItem.bookId,
          sourceChapterId: currentItem.chapterId,
          word: currentItem.word,
        });
        trackEvent("adaptive_review_rated", {
          rating,
          remaining_count: remainingCount,
          source: "local_fallback",
        });
        return;
      }

      const response = await fetch(`${REVIEW_API_PATH}/rate`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          bookId: currentItem.bookId,
          chapterId: currentItem.chapterId,
          word: currentItem.word,
          rating,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (isLocalFallbackItem) {
          recordQuizQuestionCompleted({
            sourceBookId: currentItem.bookId,
            sourceChapterId: currentItem.chapterId,
            word: currentItem.word,
          });
          trackEvent("adaptive_review_rated", {
            rating,
            remaining_count: remainingCount,
            source: "local_fallback",
          });
          return;
        }

        const errorMessage =
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Unable to update review progress.";
        throw new Error(errorMessage);
      }

      recordQuizQuestionCompleted({
        sourceBookId: currentItem.bookId,
        sourceChapterId: currentItem.chapterId,
        word: currentItem.word,
      });
      trackEvent("adaptive_review_rated", {
        rating,
        remaining_count: remainingCount,
      });

      if (shouldReloadQueueAfterSave && !isLocalFallbackItem) {
        await loadAdaptiveReviewQueue(20, { silent: true, bookId: currentItem.bookId });
        trackEvent("adaptive_review_completed", {});
      }
    } catch (error) {
      setAdaptiveReviewError(error instanceof Error ? error.message : "Unable to update review progress.");
    } finally {
      adaptiveReviewRatingInFlightRef.current.delete(itemKey);
      setAdaptiveReviewPendingRating("");
    }
  }, [adaptiveReviewItems, authToken, loadAdaptiveReviewQueue, recordQuizQuestionCompleted]);

  useEffect(() => {
    if (!authToken) {
      setAdaptiveReviewItems([]);
      setAdaptiveReviewStats({ dueNow: 0 });
      setAdaptiveReviewBookSummaries([]);
      setSelectedAdaptiveReviewBookId("");
      setAdaptiveReviewLoading(false);
      setAdaptiveReviewError("");
      setAdaptiveReviewPendingRating("");
      return;
    }

    loadAdaptiveReviewSummary({ silent: true });
  }, [authToken, loadAdaptiveReviewSummary]);

  function renderWithSidebar(content) {
    const isGuidedModalOpen = Boolean(guidedTourStep && (noticeModal || isAddBookModalOpen));
    const inDefinitions =
      screen === "definitions" || screen === "definitionsSelect" || screen === "chapters";
    const inFlashcards = screen === "flashcards" || screen === "flashcardsSelect";
    const inQuiz = screen === "quiz" || screen === "quizSelect";
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

    const stopGuidedTourForSidebarNavigation = () => {
      if (!guidedTourStep) return;
      setGuidedTourStep("");
      setIsGuidedTourDismissed(true);
    };

    return (
      <div className={`appShell ${guidedTourStep && !isOnboardingTutorialOpen && !isOnboardingCloseConfirmOpen ? "isGuidedLocked" : ""} ${isGuidedModalOpen ? "hasGuidedModalOpen" : ""}`}>
        <aside
          ref={sidebarRef}
          className={`sidebar ${isSidebarHidden ? "isCollapsed" : ""}`}
          onClickCapture={stopGuidedTourForSidebarNavigation}
        >
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
        <main className="appMain">
          {mainContent}
          {renderGuidedTourCoach("floating")}
        </main>
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
    if (authToken && !isCloudStateHydrated) return;
    const localUpdatedAt = new Date().toISOString();
    const persistedState = {
      vocab_books: JSON.stringify(books),
      vocab_theme: theme,
      [UI_LANGUAGE_STORAGE_KEY]: preferredLanguage,
      [DICTIONARY_PREFERENCE_STORAGE_KEY]: dictionaryPreference,
      vocab_sidebar_hidden: JSON.stringify(isSidebarHidden),
      vocab_weekly_stats: JSON.stringify(weeklyStats),
      vocab_activity_history: JSON.stringify(activityHistory),
      vocab_pro_daily_goal_questions: JSON.stringify(proDailyGoalQuestions),
      vocab_feature_daily_goals_enabled: JSON.stringify(isDailyGoalsEnabled),
      vocab_free_daily_usage: JSON.stringify(freeDailyUsage),
      vocab_last_quiz_mistakes: JSON.stringify(lastQuizMistakeKeys),
      vocab_last_quiz_mistakes_by_book: JSON.stringify(lastQuizMistakeKeysByBook),
      vocab_last_quiz_mistake_mode: lastQuizMistakeMode,
      vocab_last_quiz_mistake_mode_by_book: JSON.stringify(lastQuizMistakeModeByBook),
      vocab_last_quiz_setup: JSON.stringify(lastQuizSetup),
      vocab_streak: JSON.stringify(streak),
      [LOCAL_STATE_UPDATED_AT_STORAGE_KEY]: localUpdatedAt,
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
    isDailyGoalsEnabled,
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
    isCloudStateHydrated,
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
    const referralCode = String(authForm.referralCode || "").trim().toUpperCase().replace(/\s+/g, "");
    const registerPreferredLanguage = parseStoredUiLanguage(
      authForm.preferredLanguage,
      preferredLanguage
    );
    const registerDictionaryPreference = parseStoredDictionaryPreference(
      authForm.dictionaryPreference,
      dictionaryPreference
    );

    if (mode === "register" && !username) {
      setAuthError("Enter a username. " + SIGNUP_USERNAME_MESSAGE);
      return;
    }
    if (mode === "register" && !password) {
      setAuthError("Enter a password. " + SIGNUP_PASSWORD_MESSAGE);
      return;
    }
    if (!username || !password) {
      setAuthError("Enter your username/email and password.");
      return;
    }
    if (mode === "register" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    if (mode === "register" && !isValidSignupUsername(username)) {
      setAuthError(SIGNUP_USERNAME_MESSAGE);
      return;
    }
    if (mode === "register" && !isValidSignupPassword(password)) {
      setAuthError(SIGNUP_PASSWORD_MESSAGE);
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
                referralCode,
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
                : backendError === "invalid-referral-code"
                  ? "That referral code is not active. Check the code and try again."
                : backendError === "invalid-username"
                  ? SIGNUP_USERNAME_MESSAGE
                  : backendError === "inappropriate-username"
                    ? "Choose a different username. That one contains a blocked word."
                  : backendError === "weak-password"
                    ? SIGNUP_PASSWORD_MESSAGE
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
        localStorage.setItem(ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY, nextUsername || "1");
        setOnboardingTutorialStep(0);
        setIsOnboardingTutorialOpen(true);
      }
      setAuthForm({
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        referralCode: "",
        preferredLanguage: registerPreferredLanguage,
        dictionaryPreference: registerDictionaryPreference,
        acceptedLegal: false,
        marketingOptIn: false,
      });
      if (mode !== "register") {
        openNoticeModal(`Signed in as ${nextUsername}.`, "Account Ready");
      }
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
    setHasCompletedOnboardingThisSession(false);
    setGuidedTourStep("");
    setIsGuidedTourDismissed(false);
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
    setAccountActionError("");
    setIsChangePasswordModalOpen(false);
    setIsDailyGoalModalOpen(false);
    setAuthForm({
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      referralCode: "",
      preferredLanguage,
      dictionaryPreference,
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
        const response = await fetchWithRetry(`${AUTH_API_PATH}/account`, {
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
      const response = await fetchWithRetry(`${AUTH_API_PATH}/account`, {
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
      const response = await fetchWithRetry(`${BILLING_API_PATH}/status`, {
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
      return;
    }
    void loadBillingStatus();
    void loadAccountProfile();
  }, [authToken, loadBillingStatus, loadAccountProfile]);

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
        const response = await fetchWithRetry(`${ANALYTICS_API_PATH}/retention/ping`, {
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

  useEffect(() => {
    let cancelled = false;

    async function hydrateCloudState() {
      if (!authToken) {
        setIsCloudStateHydrated(false);
        return;
      }

      setIsLocalPersistencePaused(true);
      setIsCloudStateHydrated(false);
      let shouldResumePersistence = true;

      try {
        const response = await fetchWithRetry(STATE_API_PATH, {
          credentials: "include",
          headers: buildAuthHeaders(authToken),
        });

        if (response.status === 401) {
          shouldResumePersistence = false;
          if (!cancelled) {
            setAuthToken("");
            setAuthUsername("");
            setAuthError("Your session expired. Please log in again.");
            setIsLocalPersistencePaused(false);
            setIsCloudStateHydrated(false);
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
          const localUpdatedAtMs = parseTimestampMs(
            localStorage.getItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY)
          );
          const cloudUpdatedAtMs = parseTimestampMs(payload?.updatedAt);
          const localBooks = parseJsonSafely(localStorage.getItem("vocab_books"), []);
          const localWordCount = countStoredWords(localBooks);
          const cloudWordCount = countStoredWords(stateData?.books);
          if (localUpdatedAtMs && (!cloudUpdatedAtMs || localUpdatedAtMs > cloudUpdatedAtMs + 1000)) {
            return;
          }
          if (!localUpdatedAtMs && localWordCount > cloudWordCount) {
            return;
          }
          applyAppDataSnapshot(stateData);
        }
      } catch {
        // Keep local state when cloud sync is unavailable.
      } finally {
        if (!cancelled && shouldResumePersistence) {
          setIsCloudStateHydrated(true);
          setIsLocalPersistencePaused(false);
        }
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
      fetchWithRetry(STATE_API_PATH, {
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
              freeDailyUsage,
              proDailyGoalQuestions,
              isDailyGoalsEnabled,
              lastQuizMistakeKeys,
              lastQuizMistakeKeysByBook,
              lastQuizMistakeMode,
              lastQuizMistakeModeByBook,
              lastQuizSetup,
            },
          },
        }),
      }).then(async (response) => {
        if (response.ok) {
          const payload = await response.json().catch(() => null);
          const hasValidSavePayload =
            payload &&
            typeof payload === "object" &&
            !Array.isArray(payload) &&
            Number.isFinite(Number(payload.userId)) &&
            String(payload.updatedAt || "").trim();
          if (!hasValidSavePayload) {
            throw new Error("invalid-cloud-state-save-response");
          }
          return;
        }

        if (response.status === 401) {
          setAuthToken("");
          setAuthUsername("");
          setAuthError("Your session expired. Please log in again.");
          return;
        }

        const payload = await response.json().catch(() => ({}));
        const errorCode = String(payload?.error || response.statusText || "cloud-state-save-failed").trim();
        throw new Error(errorCode);
      }).catch((error) => {
        // Keep app fully usable even if cloud save fails.
        console.warn("Cloud state save failed.", error);
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
    freeDailyUsage,
    proDailyGoalQuestions,
    isDailyGoalsEnabled,
    lastQuizMistakeKeys,
    lastQuizMistakeKeysByBook,
    lastQuizMistakeMode,
    lastQuizMistakeModeByBook,
    lastQuizSetup,
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
    setNewChapterName("");
    setSelectedChapterIdForNewWords(fallbackChapterId);
  }, [currentBookId, screen, fallbackChapterId]);

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
    setNewBookLanguageMode(parseBookLanguageMode(dictionaryPreference, DEFAULT_BOOK_LANGUAGE_MODE));
    setIsAddBookModalOpen(true);
    if (guidedTourStep === "dashboard-add-book") {
      setGuidedTourStep("book-name");
    }
  }

  function closeAddBookModal() {
    setIsAddBookModalOpen(false);
    if (guidedTourStep === "book-name" || guidedTourStep === "book-create") {
      setGuidedTourStep("");
      setIsGuidedTourDismissed(true);
    }
  }

  function createBook() {
    const name = newBookName.trim();
    if (!name) return;
    const newBook = {
      id: Date.now(),
      name,
      languageMode: parseBookLanguageMode(newBookLanguageMode, DEFAULT_BOOK_LANGUAGE_MODE),
      words: [],
      chapters: [createDefaultChapter()],
      questionsCompleted: 0,
      lastOpened: Date.now(),
    };
    setBooks([...books, newBook]);
    setCurrentBookId(newBook.id);
    setScreen("bookMenu");
    setIsAddBookModalOpen(false);
    setNewBookName("");
    setNewBookLanguageMode(parseBookLanguageMode(dictionaryPreference, DEFAULT_BOOK_LANGUAGE_MODE));
    if (guidedTourStep === "book-create" || guidedTourStep === "book-name") {
      setGuidedTourStep("book-definitions");
    }
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
    deleteWord(wordEntry.word, wordIndex);
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
    const importedIsDailyGoalsEnabled = parseStoredBoolean(
      rawData?.isDailyGoalsEnabled,
      isDailyGoalsEnabled
    );
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
    setIsDailyGoalsEnabled(importedIsDailyGoalsEnabled);
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
      isDailyGoalsEnabled,
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
        isDailyGoalsEnabled,
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

  const completeOnboardingTutorial = useCallback(() => {
    if (authUsername && !isDevTutorialAccount(authUsername)) {
      localStorage.setItem(getOnboardingSeenStorageKey(authUsername), "1");
    }
    localStorage.removeItem(ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY);
    setIsOnboardingTutorialOpen(false);
    setIsOnboardingCloseConfirmOpen(false);
    setOnboardingTutorialStep(0);
    setHasCompletedOnboardingThisSession(true);
  }, [authUsername]);

  function focusAddWordFieldSoon() {
    window.setTimeout(() => {
      document.querySelector(".addWordFieldGroup input")?.focus();
    }, 80);
  }

  function startGuidedDashboardTour() {
    completeOnboardingTutorial();
    setIsGuidedTourDismissed(false);
    setGuidedTourStep("dashboard-add-book");
    setScreen("dashboard");
  }

  function getGuidedTourStep() {
    if (!guidedTourStep) return null;

    const wordCount = (currentBook?.words || []).length;
    const needsMoreWords = wordCount < 2;

    if (guidedTourStep === "dashboard-add-book") {
      return {
        key: "dashboard-add-book",
        stepLabel: "Step 1",
        title: tr("Create a book", "Create a book"),
        body: tr("Press this + button to make your first vocabulary book.", "Press this + button to make your first vocabulary book."),
      };
    }

    if (guidedTourStep === "book-name") {
      return {
        key: "book-name",
        stepLabel: "Step 1",
        title: tr("Name your book", "Name your book"),
        body: tr("Type a short name, then choose whether this book is English, English to Japanese, or Japanese to English.", "Type a short name, then choose whether this book is English, English to Japanese, or Japanese to English."),
      };
    }

    if (guidedTourStep === "book-create") {
      return {
        key: "book-create",
        stepLabel: "Step 1",
        title: tr("Press Create", "Press Create"),
        body: tr("This button saves the book and opens the next step.", "This button saves the book and opens the next step."),
      };
    }

    if (guidedTourStep === "book-definitions") {
      return {
        key: "book-definitions",
        stepLabel: "Step 2",
        title: tr("Open Definitions", "Open Definitions"),
        body: tr("Press Definitions. This is where new words are added to the book.", "Press Definitions. This is where new words are added to the book."),
      };
    }

    if (guidedTourStep === "word-type") {
      return {
        key: "word-type",
        stepLabel: "Step 2",
        title: tr(needsMoreWords ? "Type a word" : "Words are ready", needsMoreWords ? "Type a word" : "Words are ready"),
        body: tr(
          needsMoreWords
            ? `Add ${2 - wordCount} more word${2 - wordCount === 1 ? "" : "s"} so the quiz has enough choices.`
            : "You have enough words for a starter quiz.",
          needsMoreWords
            ? `Add ${2 - wordCount} more word${2 - wordCount === 1 ? "" : "s"} so the quiz has enough choices.`
            : "You have enough words for a starter quiz."
        ),
      };
    }

    if (guidedTourStep === "word-add") {
      return {
        key: "word-add",
        stepLabel: "Step 2",
        title: tr("Press + to save it", "Press + to save it"),
        body: tr("Vocalibry will fetch the right meaning for this book's language mode.", "Vocalibry will fetch the right meaning for this book's language mode."),
      };
    }

    if (guidedTourStep === "word-saving") {
      return {
        key: "word-saving",
        stepLabel: "Step 2",
        title: tr("Saving the word", "Saving the word"),
        body: tr("Wait here while Vocalibry fetches and saves the meaning.", "Wait here while Vocalibry fetches and saves the meaning."),
      };
    }

    if (guidedTourStep === "definitions-back") {
      return {
        key: "definitions-back",
        stepLabel: "Step 3",
        title: tr("Go back to the book menu", "Go back to the book menu"),
        body: tr("Now press this back button so we can start a quiz from the book menu.", "Now press this back button so we can start a quiz from the book menu."),
      };
    }

    if (guidedTourStep === "book-quiz") {
      return {
        key: "book-quiz",
        stepLabel: "Step 3",
        title: tr("Open Quiz", "Open Quiz"),
        body: tr("Press Quiz to review the words you just saved.", "Press Quiz to review the words you just saved."),
      };
    }

    if (guidedTourStep === "quiz-start") {
      return {
        key: "quiz-start",
        stepLabel: "Step 3",
        title: tr("Start the quiz", "Start the quiz"),
        body: tr("Press Start Smart Quiz to begin reviewing your saved words.", "Press Start Smart Quiz to begin reviewing your saved words."),
      };
    }

    return null;
  }

  function renderGuidedTourCoach(placement = "floating", targetKey = "") {
    const guidedStep = getGuidedTourStep();
    if (!guidedStep || isOnboardingTutorialOpen || isOnboardingCloseConfirmOpen) return null;
    if (targetKey && guidedStep.key !== targetKey) return null;
    if (!targetKey && screen === "dashboard" && guidedStep.key === "dashboard-add-book") return null;
    if (!targetKey && screen === "bookMenu" && (guidedStep.key === "book-definitions" || guidedStep.key === "book-quiz")) return null;
    if (!targetKey && screen === "definitions" && ["word-type", "word-add", "word-saving", "definitions-back"].includes(guidedStep.key)) return null;
    if (!targetKey && isAddBookModalOpen && ["book-name", "book-create"].includes(guidedStep.key)) return null;
    if (!targetKey && screen === "quizSelect" && guidedStep.key === "quiz-start") return null;

    return (
      <aside className={`guidedCoach guidedCoach-${guidedStep.key} guidedCoach-${placement}`} aria-live="polite">
        <div className="guidedCoachTopRow">
          <span className="guidedCoachStep">{guidedStep.stepLabel}</span>
        </div>
        <h2>{guidedStep.title}</h2>
        <p>{guidedStep.body}</p>
        <div className="guidedCoachActions">
          <span className="guidedCoachHint">{tr("Use the highlighted control.", "Use the highlighted control.")}</span>
        </div>
      </aside>
    );
  }

  useEffect(() => {
    if (!guidedTourStep) return;

    if (guidedTourStep === "word-saving" && !loading) {
      if (currentBookWordCount >= 2) {
        setGuidedTourStep("definitions-back");
      } else {
        setGuidedTourStep("word-type");
        focusAddWordFieldSoon();
      }
    }
  }, [guidedTourStep, loading, currentBookWordCount]);

  useEffect(() => {
    if (!authToken || !authUsername) return;
    if (isDevTutorialAccount(authUsername)) {
      if (hasCompletedOnboardingThisSession) return;
      localStorage.removeItem(getOnboardingSeenStorageKey(authUsername));
      localStorage.removeItem(ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY);
      setGuidedTourStep("");
      setIsGuidedTourDismissed(false);
      setOnboardingTutorialStep(0);
      setIsOnboardingCloseConfirmOpen(false);
      setIsOnboardingTutorialOpen(true);
      return;
    }
    const pendingTutorialFor = String(
      localStorage.getItem(ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY) || ""
    ).trim();
    if (!pendingTutorialFor) return;
    const seenKey = getOnboardingSeenStorageKey(authUsername);
    if (localStorage.getItem(seenKey) === "1") {
      localStorage.removeItem(ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY);
      return;
    }
    const shouldOpen =
      pendingTutorialFor === "1" ||
      pendingTutorialFor === "true" ||
      pendingTutorialFor.toLowerCase() === authUsername.toLowerCase();
    if (!shouldOpen) return;
    setOnboardingTutorialStep(0);
    setIsOnboardingTutorialOpen(true);
    setIsOnboardingCloseConfirmOpen(false);
  }, [authToken, authUsername, hasCompletedOnboardingThisSession]);

  useEffect(() => {
    if (!authToken || !isDevTutorialAccount(authUsername)) return;
    if (isGuidedTourDismissed || guidedTourStep) return;
    if (isOnboardingTutorialOpen || isOnboardingCloseConfirmOpen) return;
    setGuidedTourStep("dashboard-add-book");
    setScreen("dashboard");
  }, [
    authToken,
    authUsername,
    guidedTourStep,
    isGuidedTourDismissed,
    isOnboardingTutorialOpen,
    isOnboardingCloseConfirmOpen,
  ]);

  useEffect(() => {
    const isModalOpen =
      isOnboardingTutorialOpen ||
      isAddBookModalOpen ||
      isChangePasswordModalOpen ||
      Boolean(accountPanelModal) ||
      isDailyGoalModalOpen ||
      Boolean(bookPendingRename) ||
      Boolean(bookPendingDelete) ||
      Boolean(chapterPendingDelete) ||
      Boolean(noticeModal);
    if (!isModalOpen) return;

    const closeModal = () => {
      if (guidedTourStep) {
        if (noticeModal) setNoticeModal(null);
        return;
      }
      if (isOnboardingCloseConfirmOpen) setIsOnboardingCloseConfirmOpen(false);
      else if (isOnboardingTutorialOpen) setIsOnboardingCloseConfirmOpen(true);
      if (isAddBookModalOpen) setIsAddBookModalOpen(false);
      if (isChangePasswordModalOpen) setIsChangePasswordModalOpen(false);
      if (accountPanelModal) setAccountPanelModal("");
      if (isDailyGoalModalOpen) setIsDailyGoalModalOpen(false);
      if (bookPendingRename) setBookPendingRename(null);
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
  }, [
    isOnboardingTutorialOpen,
    isOnboardingCloseConfirmOpen,
    isAddBookModalOpen,
    isChangePasswordModalOpen,
    accountPanelModal,
    isDailyGoalModalOpen,
    bookPendingRename,
    bookPendingDelete,
    chapterPendingDelete,
    isDeleteAccountConfirmOpen,
    noticeModal,
    completeOnboardingTutorial,
    guidedTourStep,
  ]);

  function renderModal() {
    if (isOnboardingTutorialOpen) {
      const slideCount = ONBOARDING_TUTORIAL_SLIDES.length;
      const currentSlideIndex = Math.min(onboardingTutorialStep, slideCount - 1);
      const currentSlide = ONBOARDING_TUTORIAL_SLIDES[currentSlideIndex];
      const isLastSlide = currentSlideIndex === slideCount - 1;
      const requestCloseOnboardingTutorial = () => setIsOnboardingCloseConfirmOpen(true);

      if (isOnboardingCloseConfirmOpen) {
        return (
          <div className="modalOverlay" onClick={() => setIsOnboardingCloseConfirmOpen(false)}>
            <div
              className="modalCard"
              ref={modalRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="tutorial-close-confirm-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="tutorial-close-confirm-title">{tr("Close tutorial?", "チュートリアルを閉じますか？")}</h3>
              <p>{tr("Are you sure? You can keep going to finish the quick tour.", "本当に閉じますか？続けるとクイックツアーを完了できます。")}</p>
              <div className="modalActions">
                <button
                  type="button"
                  className="modalBtn ghost"
                  onClick={() => setIsOnboardingCloseConfirmOpen(false)}
                >
                  {tr("Keep going", "続ける")}
                </button>
                <button type="button" className="modalBtn primary" onClick={completeOnboardingTutorial}>
                  {tr("Close tutorial", "閉じる")}
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="modalOverlay tutorialOverlay" onClick={requestCloseOnboardingTutorial}>
          <div
            className="modalCard tutorialModalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-tutorial-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tutorialModalHeader">
              <span className="tutorialEyebrow">
                {tr(`Step ${currentSlideIndex + 1} of ${slideCount}`, `ステップ ${currentSlideIndex + 1} / ${slideCount}`)}
              </span>
              <button
                type="button"
                className="tutorialCloseBtn"
                aria-label={tr("Skip tutorial", "チュートリアルを閉じる")}
                onClick={requestCloseOnboardingTutorial}
              >
                &times;
              </button>
            </div>
            {currentSlide.type === "welcome" ? (
                <div className="tutorialWelcomeSlide">
                  <div className="tutorialWelcomeIcon" aria-hidden="true">✨</div>
                  <div className="tutorialCopy tutorialWelcomeCopy">
                    <h3 id="onboarding-tutorial-title">{currentSlide.title}</h3>
                    <p>{currentSlide.body}</p>
                  </div>
                  <div className="tutorialWelcomeHighlights" aria-label={tr("Tutorial overview", "チュートリアル概要")}>
                    {currentSlide.highlights.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              ) : currentSlide.type === "action" ? (
                <div className="tutorialActionSlide">
                  <div className="tutorialActionPreview" aria-hidden="true">
                    <div className="tutorialActionPreviewHeader">
                      <span>{tr("My First Book", "My First Book")}</span>
                      <span>{tr("Definitions", "Definitions")}</span>
                    </div>
                    <div className="tutorialActionInputRow">
                      <span>{tr("serendipity", "serendipity")}</span>
                      <strong>+</strong>
                    </div>
                    <div className="tutorialActionResult">
                      <strong>{tr("serendipity", "serendipity")}</strong>
                      <p>{tr("A useful word saved with its definition, ready for flashcards and quizzes.", "A useful word saved with its definition, ready for flashcards and quizzes.")}</p>
                    </div>
                  </div>
                  <div className="tutorialCopy tutorialActionCopy">
                    <h3 id="onboarding-tutorial-title">{currentSlide.title}</h3>
                    <p>{currentSlide.body}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="tutorialImageFrame">
                    <img src={currentSlide.image} alt={currentSlide.alt} />
                  </div>
                  <div className="tutorialCopy">
                    <h3 id="onboarding-tutorial-title">{currentSlide.title}</h3>
                    <p>{currentSlide.body}</p>
                  </div>
                </>
            )}
            <div className="tutorialDots" aria-label={tr("Tutorial progress", "チュートリアル進行状況")}>
              {ONBOARDING_TUTORIAL_SLIDES.map((slide, index) => (
                <button
                  type="button"
                  key={slide.title}
                  className={`tutorialDot ${index === currentSlideIndex ? "isActive" : ""}`}
                  aria-label={tr(`Go to step ${index + 1}`, `ステップ ${index + 1} へ`)}
                  aria-current={index === currentSlideIndex ? "step" : undefined}
                  onClick={() => {
                    setOnboardingTutorialStep(index);
                  }}
                />
              ))}
            </div>
            <div className="modalActions tutorialActions">
              <button
                type="button"
                className="modalBtn ghost"
                onClick={() => {
                  setOnboardingTutorialStep((step) => Math.max(0, step - 1));
                }}
                disabled={currentSlideIndex === 0}
              >
                {tr("Back", "戻る")}
              </button>
              <button
                type="button"
                className="modalBtn primary"
                onClick={() => {
                  if (isLastSlide) {
                    startGuidedDashboardTour();
                    return;
                  }
                  setOnboardingTutorialStep((step) => Math.min(slideCount - 1, step + 1));
                }}
              >
                {isLastSlide ? tr("Start guided setup", "学習を始める") : tr("Next", "次へ")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isAddBookModalOpen) {
      return (
        <div className="modalOverlay" onClick={closeAddBookModal}>
          <div
            className="modalCard createBookModalCard"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-book-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-book-title">{tr("Create Book", "ブック作成")}</h3>
            <div className="createBookFields">
              <input
                className={guidedTourStep === "book-name" ? "guidedTarget" : ""}
                value={newBookName}
                onChange={(e) => {
                  setNewBookName(e.target.value);
                  if (guidedTourStep === "book-name" && e.target.value.trim()) {
                    setGuidedTourStep("book-create");
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && createBook()}
                placeholder={tr("Enter book name", "ブック名を入力")}
                autoFocus
              />
              <div className="settingsRow createBookLanguageRow">
                <span>{tr("Language mode", "学習モード")}</span>
                <InAppDropdown
                  value={newBookLanguageMode}
                  options={BOOK_LANGUAGE_MODE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(nextMode) => {
                    setNewBookLanguageMode(parseBookLanguageMode(nextMode, DEFAULT_BOOK_LANGUAGE_MODE));
                  }}
                  className="settingsDropdown"
                  triggerClassName="isSettings"
                  menuClassName="isSettings"
                />
              </div>
            </div>
            <p className="settingsHint">
              {tr(
                "This keeps each book focused on one learning direction.",
                "各ブックを1つの学習方向に集中させます。"
              )}
            </p>
            {renderGuidedTourCoach("inline", "book-name")}
            <div className="modalActions">
              <button type="button" className="modalBtn ghost" onClick={closeAddBookModal}>
                {tr("Cancel", "キャンセル")}
              </button>
              <button
                type="button"
                className={`modalBtn primary ${guidedTourStep === "book-create" ? "guidedTarget" : ""}`}
                onClick={createBook}
                disabled={!newBookName.trim()}
              >
                {tr("Create", "作成")}
              </button>
              {renderGuidedTourCoach("inlineRight", "book-create")}
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
                {isLifetimePro ? (
                  <div className="accountFoundingBadgeWrap">
                    <span className="accountFoundingBadge">{tr("Lifetime Pro", "永久Pro")}</span>
                  </div>
                ) : null}
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
                    <option value="ja_en">
                      {tr("Japanese to English", "\u65E5\u672C\u8A9E\u2192\u82F1\u8A9E")}
                    </option>
                  </select>
                </div>
                {isLifetimePro ? (
                  <div className="accountFoundingBadgeWrap">
                    <span className="accountFoundingBadge accountFoundingBadgeInline">
                      {tr("Lifetime Pro", "永久Pro")}
                    </span>
                  </div>
                ) : null}
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

    if (isDailyGoalModalOpen && isDailyGoalsEnabled) {
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
                  openQuizSetup();
                }}
              >
                {tr("Open Quiz Setup", "クイズ設定を開く")}
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
    const languageModeMeta = getBookLanguageModeMeta(book?.languageMode);
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
          <div className="selectBookTitleRow">
            <h3 className="selectBookTitle">
              {book.name}
            </h3>
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
          <p className="selectBookLastOpened">
            {languageModeMeta.shortLabel} | Last opened: {lastOpenedText}
          </p>
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
            <span>Mode</span>
            <strong>{languageModeMeta.shortLabel}</strong>
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
    const languageModeMeta = getBookLanguageModeMeta(book?.languageMode);
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
        <div className="selectBookCardTop">
          <div className="bookCardActions">
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
          </div>
          <div className="selectBookTitleRow">
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
            <h3 className="selectBookTitle">
              {book.name}
            </h3>
          </div>
          <p className="selectBookLastOpened">
            {languageModeMeta.shortLabel} | Last opened: {lastOpenedText}
          </p>
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
            <span>Mode</span>
            <strong>{languageModeMeta.shortLabel}</strong>
          </div>
        </div>
      </div>
    );
  }

  function renderEmptyActionState({
    icon = "\u2728",
    title,
    body,
    primaryLabel,
    onPrimary,
    secondaryLabel,
    onSecondary,
  }) {
    return (
      <div className="emptyActionState">
        <div className="emptyActionIcon" aria-hidden="true">{icon}</div>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="emptyActionButtons">
          {primaryLabel && onPrimary ? (
            <button type="button" className="primaryBtn" onClick={onPrimary}>
              {primaryLabel}
            </button>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <button type="button" className="secondaryBtn" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
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

    const cleanWord = normalizeVocabularyInput(inputWord);
    if (
      (useEnglishToJapaneseDictionary || currentBookLanguageMode === "en_en") &&
      hasJapaneseVocabularyCharacters(cleanWord)
    ) {
      openNoticeModal(uiText.wrongLanguageEnglishWord, uiText.invalidEnglishWordTitle);
      return;
    }
    const isRomanizedJapaneseInput =
      useJapaneseToEnglishDictionary && isRomanizedJapaneseVocabularyInput(cleanWord);
    if (
      useJapaneseToEnglishDictionary &&
      !hasJapaneseVocabularyCharacters(cleanWord) &&
      hasEnglishVocabularyCharacters(cleanWord) &&
      !isRomanizedJapaneseInput
    ) {
      openNoticeModal(uiText.wrongLanguageJapaneseWord, uiText.invalidEnglishWordTitle);
      return;
    }
    if (!isShortVocabularyItem(cleanWord, { allowJapanese: useJapaneseToEnglishDictionary })) {
      openNoticeModal(uiText.invalidEnglishWord, uiText.invalidEnglishWordTitle);
      return;
    }

    setLastAddedWord("");
    if (guidedTourStep === "word-add") {
      setGuidedTourStep("word-saving");
    }
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

    if (isFreeWordLimitReached) {
      const upgradeCopy = PREMIUM_UPGRADE_ENABLED
        ? "Upgrade to Pro to keep adding new words."
        : "Pro removes this cap when upgrades are enabled.";
      openNoticeModal(
        `The Free plan includes up to ${FREE_WORD_LIMIT} saved words. ${upgradeCopy} You can still review, edit, delete, and export your existing words.`,
        "Word Limit Reached"
      );
      return;
    }

    setLoading(true);
    let lookupSucceeded = false;
    let savedWordForLastAdded = cleanWord;
    try {
      let definitions = [];
      let pronunciation = "";
      let translationProvider = "";
      let definitionProvider = "";
      let translationErrorCode = "";
      let translationConfidence = "";
      let translationPartOfSpeech = "";
      let translationNote = "";
      let savedWord = cleanWord;
      let japaneseReading = "";
      let japaneseRomaji = "";

      if (useEnglishToJapaneseDictionary) {
        const translationResult = await fetchJapaneseTranslations(cleanWord);
        definitions = Array.isArray(translationResult?.translations)
          ? translationResult.translations
          : [];
        translationProvider = String(translationResult?.provider || "").trim().toLowerCase();
        translationErrorCode = String(translationResult?.error || "").trim().toLowerCase();
        pronunciation = String(translationResult?.reading || "").trim();
        translationConfidence = String(translationResult?.confidence || "").trim().toLowerCase();
        translationPartOfSpeech = String(translationResult?.partOfSpeech || "").trim();
        translationNote = String(translationResult?.note || "").trim();
        if (!definitions.length) {
          if (translationErrorCode === "invalid-vocabulary-item") {
            openNoticeModal(uiText.invalidEnglishWord, uiText.invalidEnglishWordTitle);
          } else if (translationErrorCode === "jisho-word-not-available") {
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
      } else if (useJapaneseToEnglishDictionary) {
        const translationResult = await fetchJapaneseToEnglishTranslations(cleanWord);
        definitions = Array.isArray(translationResult?.translations)
          ? translationResult.translations
          : [];
        translationProvider = String(translationResult?.provider || "").trim().toLowerCase();
        translationErrorCode = String(translationResult?.error || "").trim().toLowerCase();
        translationConfidence = String(translationResult?.confidence || "").trim().toLowerCase();
        translationPartOfSpeech = String(translationResult?.partOfSpeech || "").trim();
        translationNote = String(translationResult?.note || "").trim();
        const resolvedJapaneseWord = normalizeResolvedJapaneseWord(translationResult?.resolvedWord);
        if (isRomanizedJapaneseInput && resolvedJapaneseWord && hasJapaneseVocabularyCharacters(resolvedJapaneseWord)) {
          savedWord = resolvedJapaneseWord;
        }
        pronunciation = normalizeResolvedJapaneseWord(translationResult?.reading);
        japaneseReading = pronunciation;
        japaneseRomaji = japaneseReading ? kanaToRomaji(japaneseReading) : "";
        if (!definitions.length) {
          if (translationErrorCode === "invalid-vocabulary-item") {
            openNoticeModal(uiText.invalidEnglishWord, uiText.invalidEnglishWordTitle);
          } else if (translationErrorCode === "jisho-word-not-available") {
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
      lookupSucceeded = true;
      const exampleResult = await fetchExampleSentence({
        word: savedWord,
        definitions,
        languageMode: currentBookLanguageMode,
      });

      const normalizedSavedWord = savedWord.toLowerCase();
      const duplicateResolvedWord = savedWord !== cleanWord && currentBook.words.some(
        (w) =>
          w.word.trim().toLowerCase() === normalizedSavedWord &&
          (w.chapterId || fallbackChapterId) === safeSelectedChapterIdForNewWords
      );

      if (duplicateResolvedWord) {
        openNoticeModal(uiText.duplicateWord, uiText.duplicateWordTitle);
        return;
      }
      savedWordForLastAdded = savedWord;

      const updatedBooks = books.map((book) =>
        book.id === currentBookId
          ? {
              ...book,
              words: [
                {
                  word: savedWord,
                  pronunciation,
                  japaneseReading,
                  japaneseRomaji,
                  definitions,
                  languageMode: currentBookLanguageMode,
                  currentDefinitionIndex: 0,
                  definition: definitions[0],
                  meaningSource: useEnglishToJapaneseDictionary
                    ? "translator_en_ja"
                    : useJapaneseToEnglishDictionary
                      ? "translator_ja_en"
                      : "dictionary_en",
                  translationProvider:
                    useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                      ? translationProvider || "unknown"
                      : "",
                  translationConfidence:
                    useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                      ? translationConfidence
                      : "",
                  translationPartOfSpeech:
                    useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                      ? translationPartOfSpeech
                      : "",
                  translationNote:
                    useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                      ? translationNote
                      : "",
                  definitionProvider:
                    useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                      ? ""
                      : definitionProvider || "unknown",
                  exampleSentence: exampleResult?.sentence || "",
                  exampleTranslation: exampleResult?.translation || "",
                  exampleProvider: exampleResult?.provider || "",
                  chapterId: safeSelectedChapterIdForNewWords,
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
      setLastAddedWord(savedWordForLastAdded);
      void syncBooksForAdaptiveReview(updatedBooks).then((result) => {
        if (result?.ok) {
          void loadAdaptiveReviewSummary({ silent: true });
        }
      });
    } catch (error) {
      if (lookupSucceeded) {
        console.warn("Word was added, but post-save bookkeeping failed.", error);
        setInputWord("");
        setLastAddedWord(savedWordForLastAdded);
        return;
      }
      openNoticeModal(
        useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
          ? uiText.translationNetworkError
          : uiText.dictionaryNetworkError,
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
          {isDailyGoalsEnabled ? (
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
          <div className={`recentScroll ${guidedTourStep === "dashboard-add-book" ? "hasGuidedCoach" : ""}`}>
            <div className="guidedControlAnchor">
              <button
                className={`recentSquare addSquare ${guidedTourStep === "dashboard-add-book" ? "guidedTarget" : ""}`}
                onClick={openAddBookModal}
              >
                +
              </button>
              {renderGuidedTourCoach("below", "dashboard-add-book")}
            </div>

            {quickAccessBooks.map((book) => (
                <div key={book.id} className="recentSquareWrap">
                  <button
                    className={`recentSquare ${book.pinned ? "isPinned" : ""}`}
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
          <button
            type="button"
            className="panelCard wide"
            style={{ gridColumn: "1", gridRow: "2" }}
            onClick={openAdaptiveReviewSelect}
          >
            <span>
              {"\uD83E\uDDE0"} {tr("Adaptive Review", "é©å¿œåž‹å¾©ç¿’")}
            </span>
            <small className="settingsHint">
              {tr("Due now", "ä»Šã™ãå¾©ç¿’")}: {adaptiveReviewStats.dueNow}
            </small>
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("definitionsSelect")}
          >
            <span>{"\uD83D\uDCD8"} {tr("Definitions", "単語追加")}</span>
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("flashcardsSelect")}
          >
            <span>{"\u26A1"} {tr("Flashcards", "フラッシュカード")}</span>
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => {
              setQuizBackScreen("quizSelect");
              setQuizMode("normal");
              initializeQuizSetupSelection();
              setScreen("quizSelect");
            }}
          >
            <span>{"\u2705"} {tr("Quiz", "クイズ")}</span>
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("books")}
          >
            <span>{"\uD83D\uDCDA"} {tr("My Books", "マイブック")}</span>
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("data")}
          >
            <span>{"\uD83D\uDCCA"} {tr("Data", "データ")}</span>
          </button>
          {isMobileViewport ? (
            <button
              type="button"
              className="panelCard wide"
              onClick={() => setScreen("settings")}
            >
              <span>{"\u2699\uFE0F"} {tr("Settings", "設定")}</span>
            </button>
          ) : null}
          {isMobileViewport ? (
            <button
              type="button"
              className="panelCard wide"
              onClick={() => setScreen("account")}
            >
              <span>{"\uD83D\uDC64"} {tr("My Account", "アカウント")}</span>
            </button>
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
            <div className="analyticsCard settingsCard">
              <h3>{tr("Features", "機能")}</h3>
              <p className="settingsHint">
                {tr("Choose which dashboard features are visible.", "ダッシュボードで表示する機能を選択します。")}
              </p>
              <div className="settingsRow">
                <span>{tr("Daily Goals", "デイリー目標")}</span>
                <button
                  type="button"
                  className={`themeSwitch dailyGoalsSwitch ${isDailyGoalsEnabled ? "isDark" : ""}`}
                  onClick={() => {
                    const nextEnabled = !isDailyGoalsEnabled;
                    setIsDailyGoalsEnabled(nextEnabled);
                    if (!nextEnabled) setIsDailyGoalModalOpen(false);
                  }}
                  aria-label={tr(
                    isDailyGoalsEnabled ? "Turn off Daily Goals" : "Turn on Daily Goals",
                    isDailyGoalsEnabled ? "デイリー目標をオフにする" : "デイリー目標をオンにする"
                  )}
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
      <div className={`page ${authToken ? "" : "accountAuthPage"}`}>
        <div className="pageHeader">
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("My Account", "アカウント")}</h1>
        </div>
        <div className={`analyticsSection accountSection ${authToken ? "" : "accountAuthSection"}`}>
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
              <div className="analyticsCard settingsCard accountCard accountAuthCard">
                <h3>{tr("Account", "アカウント")}</h3>
                <div className="accountAuthHeader">
                  <span className="accountAuthIcon" aria-hidden="true">{"\uD83D\uDD10"}</span>
                  <div>
                    <h3>{authMode === "login" ? tr("Welcome back", "Welcome back") : tr("Create your account", "Create your account")}</h3>
                    <p className="settingsHint accountAuthIntro">
                      {tr("Sync your books, progress, and learning settings across devices.", "Sync your books, progress, and learning settings across devices.")}
                    </p>
                  </div>
                </div>
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
                      <option value="ja_en">
                        {tr("Dictionary: Japanese to English", "辞書: 日本語→英語")}
                      </option>
                    </select>
                  ) : null}
                  <input
                    className="settingsInput"
                    value={authForm.username}
                    onChange={(event) => {
                      const usernameValue =
                        authMode === "register" ? formatUsernameInput(event.target.value) : event.target.value;
                      setAuthForm((prev) => ({ ...prev, username: usernameValue }));
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
                      placeholder={
                        authMode === "register"
                          ? tr("password (3-24 chars, no spaces)", "パスワード（3〜24文字・スペース不可）")
                          : tr("password", "パスワード")
                      }
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
                    <input
                      className="settingsInput"
                      value={authForm.referralCode}
                      onChange={(event) => {
                        setAuthForm((prev) => ({ ...prev, referralCode: event.target.value.toUpperCase() }));
                        if (authError) setAuthError("");
                      }}
                      placeholder={tr("referral code (optional)", "紹介コード（任意）")}
                      autoComplete="off"
                      maxLength={64}
                    />
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

          </div>

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
                <button type="button" className="primaryBtn" onClick={openQuizSetup}>
                  {tr("Open Quiz Setup", "クイズ設定を開く")}
                </button>
                <button type="button" className="primaryBtn" onClick={exportWeakWordsCsv}>
                  {tr("Export Weak Words CSV", "弱点単語CSVを出力")}
                </button>
              </div>
            </div>

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
        {sortedBooksByRecent.length === 0 ? (
          renderEmptyActionState({
            icon: "\uD83D\uDCDA",
            title: tr("Create your first vocabulary book", "Create your first vocabulary book"),
            body: tr(
              "Books keep words grouped by class, novel, exam, or topic so review stays focused.",
              "Books keep words grouped by class, novel, exam, or topic so review stays focused."
            ),
            primaryLabel: tr("Add Book", "Add Book"),
            onPrimary: openAddBookModal,
          })
        ) : (
          <>
            <button className="primaryBtn" onClick={openAddBookModal}>+ {tr("Add Book", "ブック追加")}</button>
            <div className="bookGrid selectBookGrid">
              {sortedBooksByRecent.map((book) => renderMyBookCard(book))}
            </div>
          </>
        )}
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
          <div className="guidedControlAnchor">
            <button
              type="button"
              className={`panelCard bookModeCard ${guidedTourStep === "book-definitions" ? "guidedTarget" : ""}`}
              onClick={() => {
                setScreen("definitions");
                if (guidedTourStep === "book-definitions") {
                  setGuidedTourStep("word-type");
                  focusAddWordFieldSoon();
                }
              }}
            >
              <span className="bookModeIcon" aria-hidden="true">{"\uD83D\uDCD8"}</span>
              <strong>{tr("Definitions", "単語追加")}</strong>
              <p>{tr("Add and manage words, meanings, and chapter placement.", "単語・意味・章を追加/管理します。")}</p>
            </button>
            {renderGuidedTourCoach("below", "book-definitions")}
          </div>

          <button
            type="button"
            className="panelCard bookModeCard"
            onClick={() => setScreen("flashcards")}
          >
            <span className="bookModeIcon" aria-hidden="true">{"\u26A1"}</span>
            <strong>{tr("Flashcards", "フラッシュカード")}</strong>
            <p>{tr("Drill recall quickly with focused review sessions.", "集中復習で素早く記憶を強化します。")}</p>
          </button>
          <button
            type="button"
            className="panelCard bookModeCard"
            onClick={() => openAdaptiveReviewSession(currentBook?.id, { backScreen: "bookMenu" })}
          >
            <span className="bookModeIcon" aria-hidden="true">{"\uD83E\uDDE0"}</span>
            <strong>{tr("Adaptive Review", "適応型復習")}</strong>
            <p>{tr("Review only the due words from this book.", "このブックの復習期限が来た単語だけを練習します。")}</p>
          </button>
          <div className="guidedControlAnchor">
            <button
              type="button"
              className={`panelCard bookModeCard ${guidedTourStep === "book-quiz" ? "guidedTarget" : ""}`}
              onClick={() => {
                setQuizBackScreen("bookMenu");
                setQuizMode("normal");
                initializeQuizSetupSelection();
                setScreen("quizSelect");
                if (guidedTourStep === "book-quiz") {
                  setGuidedTourStep("quiz-start");
                }
              }}
            >
              <span className="bookModeIcon" aria-hidden="true">{"\u2705"}</span>
              <strong>{tr("Quiz", "クイズ")}</strong>
              <p>{tr("Test active recall with normal, typing, or mistake mode.", "通常・タイピング・ミス復習で能動想起を鍛えます。")}</p>
            </button>
            {renderGuidedTourCoach("below", "book-quiz")}
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
          renderEmptyActionState({
            icon: "\uD83D\uDCD8",
            title: tr("Add a book before adding words", "Add a book before adding words"),
            body: uiText.noBooksFound,
            primaryLabel: tr("Create Book", "Create Book"),
            onPrimary: openAddBookModal,
            secondaryLabel: tr("Back to Dashboard", "Back to Dashboard"),
            onSecondary: () => setScreen("dashboard"),
          })
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
    const isGuidingWordInput = guidedTourStep === "word-type";
    const isGuidingAddButton = guidedTourStep === "word-add";
    const isGuidingSaving = guidedTourStep === "word-saving";
    const isGuidingBackToMenu = guidedTourStep === "definitions-back";

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <div className="guidedControlAnchor">
            <button
              className={`backBtn ${isGuidingBackToMenu ? "guidedTarget" : ""}`}
              aria-label={tr("Go back", "\u623b\u308b")}
              onClick={() => {
                setScreen("bookMenu");
                if (guidedTourStep === "definitions-back") {
                  setGuidedTourStep("book-quiz");
                }
              }}
            >
              &times;
            </button>
            {renderGuidedTourCoach("below", "definitions-back")}
          </div>
          <h1>{currentBook?.name}</h1>
        </div>
        <div
          className={`inputRow ${isGuidingWordInput || isGuidingAddButton || isGuidingSaving ? "guidedTargetRow" : ""} ${
            isGuidingAddButton || isGuidingSaving ? "hasGuidedAddCoach" : ""
          }`}
        >
          <div className={`addWordFieldGroup ${isGuidingWordInput ? "guidedTarget" : ""}`}>
            <input
              value={inputWord}
              onChange={(e) => {
                setInputWord(e.target.value);
                setLastAddedWord("");
                if (guidedTourStep === "word-type" && e.target.value.trim()) {
                  setGuidedTourStep("word-add");
                }
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.nativeEvent?.isComposing) return;
                addWord();
              }}
              placeholder={currentBookLanguageModeMeta.addWordPlaceholder || uiText.addWordPlaceholder}
              disabled={loading}
            />
          </div>
          <div className="guidedControlAnchor addWordGuidedAnchor">
            <button
              type="button"
              className={`addWordBtn ${isGuidingAddButton ? "guidedTarget" : ""}`}
              onClick={addWord}
              disabled={loading || !inputWord.trim()}
              aria-label={tr("Add word", "Add word")}
            >
              {loading ? "..." : "+"}
            </button>
            {renderGuidedTourCoach("below", "word-add")}
            {renderGuidedTourCoach("below", "word-saving")}
          </div>
          {renderGuidedTourCoach("inline", "word-type")}
        </div>
        <p className="definitionAttributionNote">
          {currentBookLanguageModeMeta.attribution ||
            (useEnglishToJapaneseDictionary
              ? uiText.definitionAttributionTranslator
              : uiText.definitionAttributionDictionary)}
        </p>
        {!isProPlan ? (
          <p className={`definitionAttributionNote ${isFreeWordLimitReached ? "isWarning" : ""}`}>
            Free plan: {totalSavedWordCount} / {FREE_WORD_LIMIT} saved words
            {isFreeWordLimitReached ? ". Delete words or go Pro to add more." : ` (${freeWordLimitRemaining} left).`}
          </p>
        ) : (
          <p className="definitionAttributionNote">Pro plan: unlimited saved words.</p>
        )}
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
        {!loading && (currentBook?.words || []).length === 0 ? (
          renderEmptyActionState({
            icon: "\uD83D\uDCD8",
            title: tr("Start this book with one useful word", "Start this book with one useful word"),
            body: tr(
              currentBookLanguageModeMeta.emptyHint,
              currentBookLanguageModeMeta.emptyHint
            ),
            primaryLabel: tr("Focus word field", "Focus word field"),
            onPrimary: () => document.querySelector(".addWordFieldGroup input")?.focus(),
          })
        ) : null}
        <div className="wordList">
          {currentBook?.words.map((w, i) => {
            const definitionVariants = getWordDefinitions(w);
            const totalDefinitionVariants = definitionVariants.length;
            const currentDefinitionVariant = Math.min(
              Math.max((w.currentDefinitionIndex ?? 0) + 1, 1),
              Math.max(totalDefinitionVariants, 1)
            );
            const exampleSentence = String(w.exampleSentence || "").trim();
            const exampleTranslation = String(w.exampleTranslation || "").trim();

            return (
              <div
                key={i}
                className="wordRow"
              >
                <button className="deleteBtn" onClick={() => askDeleteWord(w, i)}>x</button>
                <div className="wordContent">
                  <div className="wordHeaderLine">
                    <div className="wordTitleGroup">
                      <strong>
                        <JapaneseWordDisplay wordEntry={w} />
                      </strong>
                      {(w.pronunciation || w.pronounciation) && !w.japaneseRomaji && (
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
                      {showLocalTranslationDebug &&
                      (String(
                        useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                          ? w.translationProvider
                          : w.definitionProvider
                      ).trim()) ? (
                        <span className="translationSourceBadge">
                          {`provider: ${String(
                            useEnglishToJapaneseDictionary || useJapaneseToEnglishDictionary
                              ? w.translationProvider
                              : w.definitionProvider
                          ).trim()}`}
                        </span>
                      ) : null}
                      {isDefinitionEdited(w) && <span className="definitionEditedBadge">Edited</span>}
                    </div>
                  </div>
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
                  {exampleSentence ? (
                    <div className="exampleList">
                      <p className="exampleItem">{exampleSentence}</p>
                      {exampleTranslation ? (
                        <p className="exampleItem exampleTranslation">{exampleTranslation}</p>
                      ) : null}
                    </div>
                  ) : null}
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
          renderEmptyActionState({
            icon: "\u26A1",
            title: tr("Flashcards need a book first", "Flashcards need a book first"),
            body: uiText.noBooksFound,
            primaryLabel: tr("Create Book", "Create Book"),
            onPrimary: openAddBookModal,
            secondaryLabel: tr("Back to Dashboard", "Back to Dashboard"),
            onSecondary: () => setScreen("dashboard"),
          })
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
    const smartQuizSelection = buildAllBooksQuizSelection(sortedBooksByRecent);
    const smartQuizWordCount = getQuizWordsForSetup(smartQuizSelection, "normal").length;
    const hasBooksForQuiz = sortedBooksByRecent.length > 0;
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
        {!hasBooksForQuiz ? (
          renderEmptyActionState({
            icon: "\u2705",
            title: tr("Quizzes start after your first book", "Quizzes start after your first book"),
            body: uiText.noBooksFound,
            primaryLabel: tr("Create Book", "Create Book"),
            onPrimary: openAddBookModal,
            secondaryLabel: tr("Back to Dashboard", "Back to Dashboard"),
            onSecondary: () => setScreen("dashboard"),
          })
        ) : (
          <div className="quizFastStartCard">
            <div>
              <h2>{tr("Fast start", "Fast start")}</h2>
              <p>
                {smartQuizWordCount >= 2
                  ? tr(`${smartQuizWordCount} words are ready for a smart quiz.`, `${smartQuizWordCount} words are ready for a smart quiz.`)
                  : tr("Add at least 2 words to unlock one-click quiz starts.", "Add at least 2 words to unlock one-click quiz starts.")}
              </p>
            </div>
            <div className="quizFastStartActions">
              <div className="guidedControlAnchor">
                <button
                  type="button"
                  className={`primaryBtn ${guidedTourStep === "quiz-start" ? "guidedTarget" : ""}`}
                  onClick={() => {
                    if (guidedTourStep === "quiz-start") {
                      setGuidedTourStep("");
                      setIsGuidedTourDismissed(true);
                    }
                    startSmartQuiz();
                  }}
                  disabled={smartQuizWordCount < 2}
                >
                  {tr("Start Smart Quiz", "Start Smart Quiz")}
                </button>
                {renderGuidedTourCoach("below", "quiz-start")}
              </div>
              <button
                type="button"
                className="secondaryBtn"
                onClick={() => {
                  applyQuickQuizSetup();
                  if (!lastQuizSetup) return;
                  const selection = {
                    bookIds: [...(lastQuizSetup.bookIds || [])],
                    chapterKeys: [...(lastQuizSetup.chapterKeys || [])],
                  };
                  if (getQuizWordsForSetup(selection, normalizeQuizMode(lastQuizSetup.mode, "normal")).length >= 2) {
                    startQuizSessionWithSetup(selection, normalizeQuizMode(lastQuizSetup.mode, "normal"));
                  }
                }}
                disabled={!lastQuizSetup}
              >
                {tr("Repeat Last Quiz", "Repeat Last Quiz")}
              </button>
            </div>
          </div>
        )}
        {hasBooksForQuiz && <div className="quizSetupStepRow" aria-label="Quiz setup steps">
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
        </div>}
        {hasBooksForQuiz && isAtTypeStep && (
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
              >
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
              >
                <span className="quizModeCardIcon" aria-hidden="true">{"\uD83D\uDD01"}</span>
                <strong>{tr("Mistake Review", "ミス復習")}</strong>
                <small>{tr("Practice only words you previously got wrong.", "以前間違えた単語だけを練習します。")}</small>
              </button>
            </div>
          </div>
        )}
        {hasBooksForQuiz && isAtBooksStep && (
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
        {hasBooksForQuiz && isAtChaptersStep && (
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
        {hasBooksForQuiz && isAtReviewStep && (
          <div className="quizSetupReviewCard">
            <h3>{tr("Review & Start", "確認して開始")}</h3>
            <div className="quizSetupSummary">
              <span>{tr("Mode", "モード")}: {quizMode === "typing" ? tr("Typing", "タイピング") : quizMode === "mistake" ? tr("Mistake Review", "ミス復習") : tr("Multiple Choice", "選択式")}</span>
              <span>{tr("Books", "ブック")}: {selectedBookCount}</span>
              <span>{tr("Chapters", "章")}: {selectedChapterCount}</span>
              <span>{tr("Matching words", "対象単語")}: {quizSetupWords.length}</span>
            </div>
          </div>
        )}
        {hasBooksForQuiz && quizMode === "mistake" && !hasPreviousQuizMistakes && (
          <p className="quizSetupHint">
            {tr("No previous quiz mistakes found yet. Complete a regular quiz first.", "前回までのミスがありません。先に通常クイズを完了してください。")}
          </p>
        )}
        {hasBooksForQuiz && !canStartQuiz && isAtReviewStep && (
          <p className="quizSetupHint">
            {tr("Select at least one book and chapter with at least 2 matching words.", "2語以上含むブックと章を選択してください。")}
          </p>
        )}
        {hasBooksForQuiz && nextStepHint ? <p className="quizSetupHint">{nextStepHint}</p> : null}
        {hasBooksForQuiz && <div className="quizFooter quizSetupFooter">
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
                {tr("Start", "開始")} {quizMode === "typing" ? tr("Typing Quiz", "タイピングクイズ") : quizMode === "mistake" ? tr("Mistake Review", "ミス復習") : tr("Quiz", "クイズ")}
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
        </div>}
        {renderModal()}
      </div>
    );
  }

  if (screen === "adaptiveReviewSelect") {
    const reviewBookSummaries = adaptiveReviewBookSummaries.map((summary) => {
      const matchingBook = books.find((book) => String(book.id) === String(summary.bookId));
      return {
        ...summary,
        bookName: matchingBook?.name || summary.bookName || "Book",
      };
    });

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("Select Review Book", "復習するブックを選択")}</h1>
        </div>
        <div className="analyticsSection">
          {adaptiveReviewLoading ? (
            <div className="analyticsCard adaptiveReviewStateCard">
              <h3>{tr("Loading review books...", "復習ブックを読み込み中...")}</h3>
              <p className="settingsHint">{tr("Checking due counts for each book.", "各ブックの復習数を確認しています。")}</p>
            </div>
          ) : null}

          {adaptiveReviewError ? (
            <div className="analyticsCard adaptiveReviewStateCard">
              <h3>{tr("Could not load review books", "復習ブックを読み込めませんでした")}</h3>
              <p className="settingsHint">{adaptiveReviewError}</p>
              <div className="modalActions">
                <button type="button" className="modalBtn primary" onClick={() => loadAdaptiveReviewSummary()}>
                  {tr("Reload", "再読み込み")}
                </button>
              </div>
            </div>
          ) : null}

          {!adaptiveReviewLoading && !adaptiveReviewError && reviewBookSummaries.length === 0 ? (
            <div className="analyticsCard adaptiveReviewStateCard">
              <h3>{tr("No books ready for review", "復習できるブックがありません")}</h3>
              <p className="settingsHint">
                {tr("Add words to a book first, then Adaptive Review can schedule them.", "まずブックに単語を追加すると、適応型復習が予定を作れます。")}
              </p>
            </div>
          ) : null}

          {!adaptiveReviewLoading && !adaptiveReviewError && reviewBookSummaries.length > 0 ? (
            <div className="adaptiveReviewBookGrid">
              {reviewBookSummaries.map((summary) => {
                const totalWords = Math.max(0, Math.floor(Number(summary.totalWords) || 0));
                const dueNow = Math.min(
                  Math.max(0, Math.floor(Number(summary.dueNow) || 0)),
                  totalWords
                );

                return (
                  <button
                    key={summary.bookId}
                    type="button"
                    className={`analyticsCard adaptiveReviewBookCard ${dueNow <= 0 ? "isEmpty" : ""}`}
                    onClick={() => {
                      if (dueNow <= 0) {
                        openNoticeModal(
                          tr("This book has no words due right now.", "このブックには現在復習期限の単語がありません。"),
                          tr("No Words Due", "復習なし")
                        );
                        return;
                      }
                      openAdaptiveReviewSession(summary.bookId, { backScreen: "adaptiveReviewSelect" });
                    }}
                  >
                    <div>
                      <h3>{summary.bookName}</h3>
                      <p className="settingsHint">
                        {totalWords} {tr("tracked words", "学習単語")}
                      </p>
                    </div>
                    <div className="adaptiveReviewBookStats">
                      <span>
                        <strong>{dueNow}</strong>
                        {tr("due", "期限")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {renderModal()}
      </div>
    );
  }

  if (screen === "adaptiveReview") {
    const selectedAdaptiveReviewBook = books.find(
      (book) => String(book.id) === String(selectedAdaptiveReviewBookId)
    );
    return renderWithSidebar(
      <AdaptiveReviewSession
        items={adaptiveReviewItems}
        stats={adaptiveReviewStats}
        title={
          selectedAdaptiveReviewBook?.name
            ? `${selectedAdaptiveReviewBook.name} Review`
            : "Adaptive Review"
        }
        scopeName={selectedAdaptiveReviewBook?.name || ""}
        loading={adaptiveReviewLoading}
        error={adaptiveReviewError}
        pendingRating={adaptiveReviewPendingRating}
        goBack={() => setScreen(adaptiveReviewBackScreen || "adaptiveReviewSelect")}
        onReload={() => loadAdaptiveReviewQueue(20, { bookId: selectedAdaptiveReviewBookId })}
        onRate={rateAdaptiveReviewWord}
        onPracticeQuiz={() => openPracticeQuizForBook(selectedAdaptiveReviewBookId)}
      />
    );
  }

  // ---------- FLASHCARDS ----------
  if (screen === "flashcards") {
    return renderWithSidebar(
      <Flashcards
        currentBook={currentBook}
        goBack={() => setScreen("bookMenu")}
        getBookChapterList={getBookChapterList}
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







