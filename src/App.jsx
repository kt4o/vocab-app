import { useState, useEffect, useRef, useCallback } from "react";
import { Flashcards } from "./components/Flashcards";
import { Quiz } from "./components/Quiz";
import { AdaptiveReviewSession } from "./components/AdaptiveReviewSession";
import { VocabGallery } from "./components/VocabGallery";
import { JapaneseWordDisplay } from "./components/JapaneseWordDisplay";
import { AudioButton } from "./components/AudioButton";
import { Info, Settings } from "lucide-react";
import { PREMIUM_UPGRADE_ENABLED } from "./config/premium";
import { identifyAnalyticsUser, resetAnalyticsIdentity, trackEvent } from "./lib/analytics.js";
import { kanaToRomaji } from "./lib/japaneseText";
import { useThemeMode } from "./hooks/useThemeMode.js";

const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000;
const ADAPTIVE_REVIEW_DAILY_LIMIT_DEFAULT = 20;
const ADAPTIVE_REVIEW_DAILY_LIMIT_MIN = 5;
const ADAPTIVE_REVIEW_DAILY_LIMIT_MAX = 100;
const ADAPTIVE_REVIEW_DAILY_LIMIT_STEP = 1;
const FREE_WORD_LIMIT = 100;
const WEAK_WORDS_RECENT_DAY_WINDOW = 21;
const WEAK_WORDS_RECENT_QUESTION_WINDOW = 120;
const DEFAULT_CHAPTER_ID = "general";
const JAPANESE_STARTER_BOOK_META = {
  id: "japanese-beginner-core-1500",
  name: "Japanese Beginner Core 1.5k",
  wordCount: 1500,
  initialAdaptiveReviewActiveCount: 20,
  sourceName: "jlpt-word-list",
  sourceUrl: "https://github.com/elzup/jlpt-word-list",
  sourceLicense: "MIT",
};
const PREMADE_BOOKS = [
  {
    ...JAPANESE_STARTER_BOOK_META,
    typeLabel: "Premade Japanese Book",
    typeLabelJa: "日本語スターターブック",
  },
];
const ADAPTIVE_REVIEW_DISPLAY_ATTRIBUTE_KEYS = [
  "word",
  "meaning",
  "kanji",
  "furigana",
  "pronunciation",
  "exampleSentence",
  "exampleTranslation",
  "chapter",
];
const DEFAULT_ADAPTIVE_REVIEW_DISPLAY_SETTINGS = {
  front: {
    word: true,
    meaning: false,
    kanji: false,
    furigana: false,
    pronunciation: true,
    exampleSentence: false,
    exampleTranslation: false,
    chapter: false,
  },
  back: {
    word: false,
    meaning: true,
    kanji: false,
    furigana: false,
    pronunciation: false,
    exampleSentence: false,
    exampleTranslation: false,
    chapter: false,
  },
};
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

function LoadingAnimation({ label, className = "" }) {
  return (
    <div className={`loadingAnimation ${className}`.trim()} role="status" aria-live="polite">
      <div className="accountSyncLoader" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      {label ? <p>{label}</p> : null}
    </div>
  );
}
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
const ONBOARDING_GOAL_STORAGE_KEY = "vocab_onboarding_goal";
const CHECKLIST_DISMISSED_PREFIX = "vocab_checklist_dismissed";
const FIRST_REVIEW_DONE_PREFIX = "vocab_first_review_done";
const GUIDED_TOUR_DONE_PREFIX = "vocab_guided_tour_done";
const ONBOARDING_GOAL_OPTIONS = [
  { id: "language", label: "A foreign language" },
  { id: "exam", label: "Exam vocabulary" },
  { id: "work", label: "Work / technical terms" },
  { id: "exploring", label: "Just exploring" },
];
const ONBOARDING_GOAL_BOOK_NAMES = {
  language: "My Language Words",
  exam: "Exam Terms",
  work: "Work Vocabulary",
};
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
    if (book?.starterBookId) return total;
    const words = Array.isArray(book?.words) ? book.words : [];
    return total + words.length;
  }, 0);
}

function isAdaptiveReviewEnabledWord(wordEntry) {
  return wordEntry?.adaptiveReviewEnabled !== false;
}

function getBookAdaptiveReviewDailyLimit(book) {
  return parseAdaptiveReviewDailyLimit(book?.adaptiveReviewDailyLimit);
}

function getBookAdaptiveReviewShuffleDue(book) {
  return parseStoredBoolean(book?.adaptiveReviewShuffleDue, false);
}

function buildLocalAdaptiveReviewSummaries(rawBooks, options = {}) {
  const books = Array.isArray(rawBooks) ? rawBooks : [];
  const excludedKeys = options?.excludedKeys instanceof Set ? options.excludedKeys : new Set();
  return books
    .map((book) => {
      const bookId = String(book?.id || "").trim();
      const words = Array.isArray(book?.words)
        ? book.words.filter(
            (wordEntry) => {
              const word = String(wordEntry?.word || "").trim();
              if (!word || !isAdaptiveReviewEnabledWord(wordEntry)) return false;
              const chapterId = String(wordEntry?.chapterId || DEFAULT_CHAPTER_ID).trim() || DEFAULT_CHAPTER_ID;
              return !excludedKeys.has(getAdaptiveReviewItemKey({ bookId, chapterId, word }));
            }
          )
        : [];
      if (!bookId || words.length === 0) return null;
      const newWordLimit = getBookAdaptiveReviewDailyLimit(book);
      const newDueNow = Math.min(words.length, newWordLimit);
      return {
        bookId,
        bookName: String(book?.name || "").trim() || "Book",
        totalWords: words.length,
        dueNow: newDueNow,
        newDueNow,
        reviewDueNow: 0,
        newWordsRemainingToday: newWordLimit,
        isLocalFallback: true,
      };
    })
    .filter(Boolean);
}

function mergeAdaptiveReviewDashboardSummaries(apiSummaries, localSummaries) {
  const apiSummaryByBookId = new Map(
    (Array.isArray(apiSummaries) ? apiSummaries : [])
      .map((summary) => [String(summary?.bookId || "").trim(), summary])
      .filter(([bookId]) => Boolean(bookId))
  );

  const merged = (Array.isArray(localSummaries) ? localSummaries : []).map((localSummary) => {
    const bookId = String(localSummary?.bookId || "").trim();
    const apiSummary = apiSummaryByBookId.get(bookId);
    const totalWords = Math.max(
      0,
      Math.floor(Number(localSummary?.totalWords ?? apiSummary?.totalWords) || 0)
    );
    const apiTotalWords = Math.max(0, Math.floor(Number(apiSummary?.totalWords) || 0));
    const missingLocalWordCount = Math.max(0, totalWords - apiTotalWords);
    const localDueNow = Math.max(0, Math.floor(Number(localSummary?.dueNow) || 0));
    const missingQueuedLocalWordCount = Math.min(missingLocalWordCount, localDueNow);
    const reviewDueNow = Math.min(
      Math.max(0, Math.floor(Number(apiSummary?.reviewDueNow) || 0)),
      totalWords
    );
    const newDueNow = Math.min(
      Math.max(0, Math.floor(Number(apiSummary?.newDueNow) || 0)) + missingQueuedLocalWordCount,
      Math.max(0, totalWords - reviewDueNow)
    );
    const dueNow = Math.min(
      reviewDueNow + newDueNow,
      totalWords
    );
    return {
      ...localSummary,
      ...apiSummary,
      bookId,
      bookName: localSummary?.bookName || apiSummary?.bookName || "Book",
      totalWords,
      dueNow,
      newDueNow,
      reviewDueNow,
      isLocalFallback: !apiSummary,
    };
  });

  apiSummaryByBookId.forEach((apiSummary, bookId) => {
    if (merged.some((summary) => String(summary?.bookId) === bookId)) return;
    merged.push(apiSummary);
  });

  return merged;
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
    loadingAccountData: "Loading your account data",
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
    loadingAccountData: "アカウントデータを読み込み中",
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

function getExampleEndpointCandidates(path) {
  const endpointCandidates = [`${EXAMPLE_API_PATH}${path}`];
  const onLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!API_BASE_URL && onLocalhost) {
    endpointCandidates.push(`http://localhost:4000/api/examples${path}`);
  }
  return endpointCandidates;
}

async function fetchExampleFurigana(sentence) {
  const input = String(sentence || "").trim();
  if (!input || !hasKanjiText(input)) return [];

  const endpointCandidates = getExampleEndpointCandidates("/furigana");
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
        body: JSON.stringify({ sentence: input }),
        timeoutMs: 14000,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) continue;
      return normalizeExampleFuriganaSegments(payload?.furigana);
    } catch {
      // Furigana is enrichment; the example sentence can still be shown.
    }
  }

  return [];
}

async function fetchExampleSentence({ word, definitions, languageMode }) {
  const input = String(word || "").trim();
  if (!input) return null;

  const endpointCandidates = getExampleEndpointCandidates("/sentence");
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
      const rawSentence = String(payload?.sentence || "").trim();
      const sentence = stripInlineJapaneseReadings(rawSentence);
      if (!sentence) continue;
      const safeLanguageMode = parseBookLanguageMode(languageMode, DEFAULT_BOOK_LANGUAGE_MODE);
      let furigana = mergeExampleFuriganaSegments(
        sentence,
        getInlineJapaneseReadingSegments(rawSentence),
        payload?.furigana
      );
      if (
        (safeLanguageMode === "en_ja" || safeLanguageMode === "ja_en") &&
        getMissingKanjiCount(sentence, furigana) > 0
      ) {
        const repairedFurigana = await fetchExampleFurigana(sentence);
        const mergedFurigana = mergeExampleFuriganaSegments(sentence, furigana, repairedFurigana);
        if (getMissingKanjiCount(sentence, mergedFurigana) < getMissingKanjiCount(sentence, furigana)) {
          furigana = mergedFurigana;
        }
      }
      return {
        sentence,
        translation: String(payload?.translation || "").trim(),
        furigana,
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
  const rawLastDate = typeof parsed?.lastDate === "string" ? parsed.lastDate.trim() : "";
  const lastDate = /^\d{4}-\d{2}-\d{2}$/.test(rawLastDate)
    ? rawLastDate
    : rawLastDate
      ? getCurrentDayKey(new Date(rawLastDate))
      : null;
  return { count, lastDate };
}

function choosePreferredStreak(currentStreak, candidateStreak) {
  const current = currentStreak || { count: 1, lastDate: null };
  const candidate = candidateStreak || { count: 1, lastDate: null };
  const currentDayIndex = parseDayKeyToDayIndex(current.lastDate);
  const candidateDayIndex = parseDayKeyToDayIndex(candidate.lastDate);

  if (candidateDayIndex !== null && currentDayIndex !== null) {
    if (candidateDayIndex > currentDayIndex) return candidate;
    if (candidateDayIndex < currentDayIndex) return current;
  } else if (candidateDayIndex !== null) {
    return candidate;
  } else if (currentDayIndex !== null) {
    return current;
  }

  const currentCount = Math.max(1, Math.floor(Number(current.count) || 1));
  const candidateCount = Math.max(1, Math.floor(Number(candidate.count) || 1));
  return candidateCount > currentCount ? candidate : current;
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

function parseAdaptiveReviewDailyLimit(value) {
  const parsed = Math.floor(Number(value) || ADAPTIVE_REVIEW_DAILY_LIMIT_DEFAULT);
  const clamped = Math.min(
    ADAPTIVE_REVIEW_DAILY_LIMIT_MAX,
    Math.max(ADAPTIVE_REVIEW_DAILY_LIMIT_MIN, parsed)
  );
  const offset = clamped - ADAPTIVE_REVIEW_DAILY_LIMIT_MIN;
  return ADAPTIVE_REVIEW_DAILY_LIMIT_MIN + Math.round(offset / ADAPTIVE_REVIEW_DAILY_LIMIT_STEP) * ADAPTIVE_REVIEW_DAILY_LIMIT_STEP;
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

function normalizeBookNameForComparison(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function makeUniqueBookName(name, usedNames) {
  const baseName = String(name || "").trim().replace(/\s+/g, " ") || "Book";
  let nextName = baseName;
  let suffix = 2;

  while (usedNames.has(normalizeBookNameForComparison(nextName))) {
    nextName = `${baseName} ${suffix}`;
    suffix += 1;
  }

  usedNames.add(normalizeBookNameForComparison(nextName));
  return nextName;
}

function sanitizeAdaptiveReviewDisplaySide(rawSide, fallbackSide) {
  const side = rawSide && typeof rawSide === "object" && !Array.isArray(rawSide) ? rawSide : {};
  return ADAPTIVE_REVIEW_DISPLAY_ATTRIBUTE_KEYS.reduce((nextSide, key) => {
    nextSide[key] = typeof side[key] === "boolean" ? side[key] : Boolean(fallbackSide?.[key]);
    return nextSide;
  }, {});
}

function sanitizeAdaptiveReviewDisplaySettings(rawSettings) {
  const settings =
    rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
      ? rawSettings
      : {};

  return {
    front: sanitizeAdaptiveReviewDisplaySide(
      settings.front,
      DEFAULT_ADAPTIVE_REVIEW_DISPLAY_SETTINGS.front
    ),
    back: sanitizeAdaptiveReviewDisplaySide(
      settings.back,
      DEFAULT_ADAPTIVE_REVIEW_DISPLAY_SETTINGS.back
    ),
  };
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
      exampleFurigana: normalizeExampleFuriganaSegments(wordEntry?.exampleFurigana),
      examplePending: Boolean(wordEntry?.examplePending) && !String(wordEntry?.exampleSentence || "").trim(),
      quizPerformanceHistory: sanitizeWordQuizPerformanceHistory(wordEntry?.quizPerformanceHistory),
    };
  });

  return {
    ...book,
    languageMode,
    adaptiveReviewDisplaySettings: sanitizeAdaptiveReviewDisplaySettings(
      book?.adaptiveReviewDisplaySettings
    ),
    adaptiveReviewDailyLimit: parseAdaptiveReviewDailyLimit(book?.adaptiveReviewDailyLimit),
    adaptiveReviewShuffleDue: parseStoredBoolean(book?.adaptiveReviewShuffleDue, false),
    chapters: uniqueChapters,
    words: normalizedWords,
  };
}

function normalizeBooksData(rawBooks) {
  const safeBooks = Array.isArray(rawBooks) ? rawBooks : [];
  const usedNames = new Set();
  return safeBooks.map((book) => {
    const normalizedBook = ensureBookChapters(book);
    return {
      ...normalizedBook,
      name: makeUniqueBookName(normalizedBook.name, usedNames),
    };
  });
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

const ONBOARDING_TUTORIAL_SLIDE = {
  title: "Welcome to Vocalibry",
  body: "Build vocabulary that actually sticks — one word at a time.",
  steps: [
    { n: "1", label: "Create a book", detail: "Name it and pick a language mode" },
    { n: "2", label: "Add words", detail: "Auto-fetched definitions, no dictionary needed" },
    { n: "3", label: "Start a quiz", detail: "Flashcards, quizzes, or Smart Review" },
  ],
};

function getOnboardingSeenStorageKey(username) {
  const safeUsername = String(username || "account").trim().toLowerCase() || "account";
  return `${ONBOARDING_TUTORIAL_SEEN_PREFIX}_${safeUsername}`;
}

function isDevTutorialAccount(username) {
  return String(username || "").trim().toLowerCase() === "dev";
}

function getChecklistDismissedKey(username) {
  return `${CHECKLIST_DISMISSED_PREFIX}_${String(username || "account").trim().toLowerCase()}`;
}

function getFirstReviewDoneKey(username) {
  return `${FIRST_REVIEW_DONE_PREFIX}_${String(username || "account").trim().toLowerCase()}`;
}

function getGuidedTourDoneKey(username) {
  return `${GUIDED_TOUR_DONE_PREFIX}_${String(username || "account").trim().toLowerCase()}`;
}

function getGuidedTourTargetSelector(step) {
  if (step === "dashboard-add-book") return ".recentSquare.addSquare";
  if (step === "book-name") return ".createBookFields input";
  if (step === "book-create") return ".createBookModalCard .modalBtn.primary";
  if (step === "book-definitions") return ".bookModeGrid .bookModeCard";
  if (step === "word-type") return ".addWordFieldGroup input";
  if (step === "word-add" || step === "word-saving") return ".addWordBtn";
  if (step === "definitions-back") return ".pageHeader .backBtn";
  if (step === "book-adaptive") return ".bookModeGrid .guidedControlAnchor .bookModeCard";
  return "";

}

function normalizeExampleFuriganaSegments(value) {
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

function hasKanjiText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function stripInlineJapaneseReadings(value) {
  return String(value || "")
    .replace(/([\u3400-\u9fff々〆ヶ]+)[(（]([\u3040-\u30ffー\s]+)[)）]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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
  let reading = String(segment?.reading || "").trim();
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

function getInlineJapaneseReadingSegments(value) {
  const text = String(value || "");
  const segments = [];
  const pattern = /([\u3400-\u9fff々〆ヶ]+)[(（]([\u3040-\u30ffー\s]+)[)）]/g;
  let match = pattern.exec(text);

  while (match) {
    const surface = String(match[1] || "").trim();
    const reading = String(match[2] || "").replace(/\s+/g, "").trim();
    if (surface && reading) {
      segments.push({ text: surface, reading });
    }
    match = pattern.exec(text);
  }

  return normalizeExampleFuriganaSegments(segments);
}

function mergeExampleFuriganaSegments(sentence, ...segmentGroups) {
  const text = String(sentence || "");
  const seen = new Set();
  return segmentGroups
    .flatMap((segments) => normalizeExampleFuriganaSegments(segments))
    .filter((segment) => text.includes(segment.text))
    .filter((segment) => {
      const key = `${segment.text}\n${segment.reading}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 80);
}

function getMissingKanjiCount(sentence, furiganaSegments) {
  const text = String(sentence || "");
  const covered = new Set();
  normalizeExampleFuriganaSegments(furiganaSegments).forEach((segment) => {
    let index = text.indexOf(segment.text);
    while (index !== -1) {
      for (let offset = 0; offset < segment.text.length; offset += 1) {
        if (hasKanjiText(segment.text[offset])) covered.add(index + offset);
      }
      index = text.indexOf(segment.text, index + segment.text.length);
    }
  });

  return Array.from(text).reduce(
    (count, char, index) => count + (hasKanjiText(char) && !covered.has(index) ? 1 : 0),
    0
  );
}

function JapaneseExampleSentence({ sentence, wordEntry }) {
  const rawText = String(sentence || "").trim();
  const text = stripInlineJapaneseReadings(rawText);
  let furiganaSegments = mergeExampleFuriganaSegments(
    text,
    getInlineJapaneseReadingSegments(rawText),
    wordEntry?.exampleFurigana
  );
  const word = String(wordEntry?.word || "").trim();
  const reading = String(
    wordEntry?.japaneseReading ||
      wordEntry?.reading ||
      wordEntry?.pronunciation ||
      wordEntry?.pronounciation ||
      ""
  ).trim();

  if (
    text &&
    word &&
    reading &&
    reading !== word &&
    text.includes(word) &&
    !furiganaSegments.some((segment) => segment.text === word)
  ) {
    const withSavedWord = mergeExampleFuriganaSegments(text, furiganaSegments, [{ text: word, reading }]);
    if (getMissingKanjiCount(text, withSavedWord) < getMissingKanjiCount(text, furiganaSegments)) {
      furiganaSegments = withSavedWord;
    }
  }

  if (text && furiganaSegments.length) {
    const joined = furiganaSegments.map((segment) => segment.text).join("");
    if (joined === text) {
      return furiganaSegments.map((segment, index) =>
        <ruby className="exampleFuriganaRuby" key={`${segment.text}-${index}`}>
          {segment.text}
          <rt>{segment.reading}</rt>
        </ruby>
      );
    }

    const parts = [];
    let cursor = 0;
    let partIndex = 0;
    const remainingSegments = [...furiganaSegments].sort((a, b) => b.text.length - a.text.length);

    while (cursor < text.length) {
      let nextMatch = null;
      for (const segment of remainingSegments) {
        const index = text.indexOf(segment.text, cursor);
        if (index === -1) continue;
        if (!nextMatch || index < nextMatch.index || (index === nextMatch.index && segment.text.length > nextMatch.segment.text.length)) {
          nextMatch = { index, segment };
        }
      }

      if (!nextMatch) {
        parts.push(text.slice(cursor));
        break;
      }

      if (nextMatch.index > cursor) {
        parts.push(text.slice(cursor, nextMatch.index));
      }
      parts.push(
        <ruby className="exampleFuriganaRuby" key={`${nextMatch.segment.text}-${partIndex}`}>
          {nextMatch.segment.text}
          <rt>{nextMatch.segment.reading}</rt>
        </ruby>
      );
      cursor = nextMatch.index + nextMatch.segment.text.length;
      partIndex += 1;
    }

    return parts;
  }

  if (!text || !word || !reading || reading === word || !text.includes(word)) {
    return text;
  }

  const parts = [];
  let cursor = 0;
  let matchIndex = text.indexOf(word, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }
    parts.push(
      <ruby className="exampleFuriganaRuby" key={`${word}-${matchIndex}`}>
        {word}
        <rt>{reading}</rt>
      </ruby>
    );
    cursor = matchIndex + word.length;
    matchIndex = text.indexOf(word, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
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
  const [onboardingGoal, setOnboardingGoal] = useState(() => localStorage.getItem(ONBOARDING_GOAL_STORAGE_KEY) || "");
  const [isChecklistDismissed, setIsChecklistDismissed] = useState(false);
  const [hasFirstReview, setHasFirstReview] = useState(false);
  const [hasCompletedGuidedTour, setHasCompletedGuidedTour] = useState(false);
  const [guidedTourStep, setGuidedTourStep] = useState("");
  const [isGuidedTourDismissed, setIsGuidedTourDismissed] = useState(false);
  const [isGuidedTourMobile, setIsGuidedTourMobile] = useState(() =>
    Boolean(window.matchMedia?.("(max-width: 700px)")?.matches)
  );
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
  const [authToken, setAuthToken] = useState(() => {
    const savedAuthToken = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
    if (isBearerAuthToken(savedAuthToken)) return savedAuthToken;
    // AppRoute.verifySession() writes this marker after a successful cookie-session check,
    // so we can skip the redundant restoreCookieSession() network call on mount.
    if (savedAuthToken === COOKIE_SESSION_AUTH_MARKER) return COOKIE_SESSION_AUTH_MARKER;
    return "";
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
  const [isStripeAnnualConfigured, setIsStripeAnnualConfigured] = useState(false);
  const [isStripeLifetimeConfigured, setIsStripeLifetimeConfigured] = useState(false);
  const [selectedBillingInterval, setSelectedBillingInterval] = useState("annual");
  const [isAccountProfileLoading, setIsAccountProfileLoading] = useState(false);
  const [isBillingStatusLoading, setIsBillingStatusLoading] = useState(false);
  const [isBillingCheckoutSubmitting, setIsBillingCheckoutSubmitting] = useState(false);
  const [isBillingPortalSubmitting, setIsBillingPortalSubmitting] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [accountPanelModal, setAccountPanelModal] = useState("");
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
  const [isAdaptiveReviewInfoOpen, setIsAdaptiveReviewInfoOpen] = useState(false);
  const [showPostTourSheet, setShowPostTourSheet] = useState(false);
  const [showFirstReviewCelebration, setShowFirstReviewCelebration] = useState(false);
  const [justCompletedFirstReview, setJustCompletedFirstReview] = useState(false);
  const [reengagementDismissed, setReengagementDismissed] = useState(false);
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
  const adaptiveReviewCompletedItemKeysRef = useRef(new Set());
  const authTokenRef = useRef("");
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
  const isSelectedIntervalConfigured =
    selectedBillingInterval === "annual"
      ? isStripeAnnualConfigured
      : selectedBillingInterval === "lifetime"
        ? isStripeLifetimeConfigured
        : isStripeBillingConfigured;
  const totalSavedWordCount = countStoredWords(books);
  const freeWordLimitRemaining = Math.max(0, FREE_WORD_LIMIT - totalSavedWordCount);
  const isFreeWordLimitReached = !isProPlan && totalSavedWordCount >= FREE_WORD_LIMIT;
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
  authTokenRef.current = authToken;
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

  function buildLocalAdaptiveReviewItems(bookId, limit = 20, options = {}) {
    const safeBookId = String(bookId || "").trim();
    const book = latestBooksRef.current.find((item) => String(item?.id) === safeBookId);
    if (!book) return [];

    const chapterNameById = new Map(
      getBookChapterList(book).map((chapter) => [String(chapter.id), chapter.name || "Chapter"])
    );
    const maxItems = Math.max(1, Math.floor(Number(limit) || 20));
    const excludedKeys = options?.excludedKeys instanceof Set ? options.excludedKeys : new Set();

    const reviewWords = (Array.isArray(book.words) ? book.words : [])
      .filter((wordEntry) => String(wordEntry?.word || "").trim() && isAdaptiveReviewEnabledWord(wordEntry))
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
          exampleSentence: String(wordEntry?.exampleSentence || "").trim(),
          exampleTranslation: String(wordEntry?.exampleTranslation || "").trim(),
          isLocalFallback: true,
        };
      })
      .filter((item) => !excludedKeys.has(getAdaptiveReviewItemKey(item)));

    return (options?.shuffleDue ? shuffleArray(reviewWords) : reviewWords).slice(0, maxItems);
  }

  function mergeAdaptiveReviewQueueItems(apiItems, localItems, limit = 20, options = {}) {
    const maxNewItems = Math.max(1, Math.floor(Number(limit) || 20));
    const minimumDueItemCount = Math.max(0, Math.floor(Number(options?.minimumDueItemCount) || 0));
    const maxItems = Math.max(maxNewItems, minimumDueItemCount, Array.isArray(apiItems) ? apiItems.length : 0);
    const mergedItems = [];
    const seenKeys = new Set();

    (Array.isArray(apiItems) ? apiItems : []).forEach((item) => {
      const itemKey = getAdaptiveReviewItemKey(item);
      if (!itemKey || seenKeys.has(itemKey)) return;
      seenKeys.add(itemKey);
      mergedItems.push(item);
    });

    if (mergedItems.length < minimumDueItemCount) {
      (Array.isArray(localItems) ? localItems : []).forEach((item) => {
        if (mergedItems.length >= minimumDueItemCount) return;
        const itemKey = getAdaptiveReviewItemKey(item);
        if (!itemKey || seenKeys.has(itemKey)) return;
        seenKeys.add(itemKey);
        mergedItems.push(item);
      });
    }

    return mergedItems.slice(0, maxItems);
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

  function isCurrentAuthRequest(requestAuthToken) {
    return String(authTokenRef.current || "") === String(requestAuthToken || "");
  }

  const flushCloudStateNow = useCallback(async () => {
    if (!authToken || !isCloudStateHydrated) return { ok: false, skipped: true };
    const requestAuthToken = authToken;
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
          clientUpdatedAt: localStorage.getItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY) || undefined,
        }),
      });

      if (response.status === 401) {
        if (!isCurrentAuthRequest(requestAuthToken)) {
          return { ok: false, unauthorized: true, stale: true };
        }
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
    const requestAuthToken = authToken;
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
        body: JSON.stringify({
          appState,
          clientUpdatedAt: localStorage.getItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY) || undefined,
        }),
      });

      if (response.status === 401) {
        if (!isCurrentAuthRequest(requestAuthToken)) {
          return { ok: false, unauthorized: true, stale: true };
        }
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
    const sourceBooks = Array.isArray(options?.books) ? options.books : latestBooksRef.current;
    const excludedItemKeys = new Set([
      ...adaptiveReviewCompletedItemKeysRef.current,
      ...adaptiveReviewRatingInFlightRef.current,
    ]);

    if (!authToken) {
      const localBookSummaries = buildLocalAdaptiveReviewSummaries(sourceBooks, {
        excludedKeys: excludedItemKeys,
      });
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
      const syncResult = await syncBooksForAdaptiveReview(sourceBooks);
      if (syncResult?.skipped) {
        const localBookSummaries = buildLocalAdaptiveReviewSummaries(sourceBooks, {
          excludedKeys: excludedItemKeys,
        });
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
      if (!syncResult?.ok && !syncResult?.skipped) {
        console.warn(
          getCloudStateSyncErrorMessage(
            syncResult,
            "Adaptive Review could not sync your latest books before loading the scheduler."
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
      const localBookSummaries = buildLocalAdaptiveReviewSummaries(latestBooksRef.current, {
        excludedKeys: excludedItemKeys,
      });
      const bookSummaries = mergeAdaptiveReviewDashboardSummaries(apiBookSummaries, localBookSummaries);

      setAdaptiveReviewBookSummaries(bookSummaries);
      setAdaptiveReviewStats({
        dueNow: bookSummaries.reduce((total, summary) => total + Math.max(0, Math.floor(Number(summary?.dueNow) || 0)), 0),
      });
      return { ok: true, payload: { ...payload, books: bookSummaries } };
    } catch (error) {
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
    const shuffleDue = Boolean(options?.shuffleDue);
    const sourceBooks = Array.isArray(options?.books) ? options.books : latestBooksRef.current;
    const excludedItemKeys = new Set([
      ...adaptiveReviewCompletedItemKeysRef.current,
      ...adaptiveReviewRatingInFlightRef.current,
    ]);

    if (!authToken) {
      const fallbackItems = bookId
        ? buildLocalAdaptiveReviewItems(bookId, limit, { shuffleDue, excludedKeys: excludedItemKeys })
        : [];
      setAdaptiveReviewItems(fallbackItems);
      setAdaptiveReviewStats({ dueNow: fallbackItems.length, newDueNow: fallbackItems.length, reviewDueNow: 0 });
      setAdaptiveReviewError("");
      setAdaptiveReviewPendingRating("");
      return {
        ok: true,
        localFallback: true,
        skipped: true,
        payload: { items: fallbackItems, stats: { dueNow: fallbackItems.length, newDueNow: fallbackItems.length, reviewDueNow: 0 } },
      };
    }

    if (showLoading) {
      setAdaptiveReviewLoading(true);
    }
    setAdaptiveReviewError("");
    try {
      const syncResult = await syncBooksForAdaptiveReview(sourceBooks);
      if (syncResult?.skipped) {
        const fallbackItems = bookId
          ? buildLocalAdaptiveReviewItems(bookId, limit, { shuffleDue, excludedKeys: excludedItemKeys })
          : [];
        setAdaptiveReviewItems(fallbackItems);
        setAdaptiveReviewStats({ dueNow: fallbackItems.length, newDueNow: fallbackItems.length, reviewDueNow: 0 });
        setAdaptiveReviewError("");
        setAdaptiveReviewPendingRating("");
        return {
          ok: true,
          localFallback: true,
          skipped: true,
          payload: { items: fallbackItems, stats: { dueNow: fallbackItems.length, newDueNow: fallbackItems.length, reviewDueNow: 0 } },
        };
      }
      if (!syncResult?.ok && !syncResult?.skipped) {
        console.warn(
          getCloudStateSyncErrorMessage(
            syncResult,
            "Adaptive Review could not sync your latest words before loading the scheduler."
          )
        );
      }
      const params = new URLSearchParams();
      params.set("limit", String(Math.max(1, Math.floor(Number(limit) || 20))));
      if (bookId) {
        params.set("bookId", bookId);
      }
      if (shuffleDue) {
        params.set("shuffleDue", "1");
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
      const visibleItems = apiItems.filter(
        (item) => !adaptiveReviewRatingInFlightRef.current.has(getAdaptiveReviewItemKey(item))
      );
      const localItems = bookId
        ? buildLocalAdaptiveReviewItems(bookId, limit, { shuffleDue, excludedKeys: excludedItemKeys })
        : [];
      const mergedItems = mergeAdaptiveReviewQueueItems(visibleItems, localItems, limit, {
        minimumDueItemCount: options?.minimumDueItemCount,
      });
      const derivedReviewDueNow = mergedItems.filter((item) => Boolean(item?.lastReviewedAt)).length;
      const derivedNewDueNow = Math.max(0, mergedItems.length - derivedReviewDueNow);
      const rawNewDueNow = Math.max(0, Math.floor(Number(payload?.stats?.newDueNow) || 0));
      const rawReviewDueNow = Math.max(0, Math.floor(Number(payload?.stats?.reviewDueNow) || 0));
      const bucketCount = rawNewDueNow + rawReviewDueNow;
      const newDueNow = bucketCount >= mergedItems.length ? rawNewDueNow : derivedNewDueNow;
      const reviewDueNow = bucketCount >= mergedItems.length ? rawReviewDueNow : derivedReviewDueNow;
      const dueNow = mergedItems.length;
      setAdaptiveReviewItems(mergedItems);
      setAdaptiveReviewStats({
        dueNow,
        newDueNow,
        reviewDueNow,
      });
      return { ok: true, payload: { ...payload, items: mergedItems, stats: { ...payload?.stats, dueNow, newDueNow, reviewDueNow } } };
    } catch (error) {
      const fallbackItems = bookId
        ? buildLocalAdaptiveReviewItems(bookId, limit, { shuffleDue, excludedKeys: excludedItemKeys })
        : [];
      if (fallbackItems.length > 0) {
        setAdaptiveReviewItems(fallbackItems);
        setAdaptiveReviewStats({ dueNow: fallbackItems.length, newDueNow: fallbackItems.length, reviewDueNow: 0 });
        setAdaptiveReviewError("");
        return { ok: true, localFallback: true, error, payload: { items: fallbackItems, stats: { dueNow: fallbackItems.length, newDueNow: fallbackItems.length, reviewDueNow: 0 } } };
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
    const reviewBook = latestBooksRef.current.find((book) => String(book?.id) === safeBookId);
    const reviewSummary = adaptiveReviewBookSummaries.find(
      (summary) => String(summary?.bookId) === safeBookId
    );
    const result = await loadAdaptiveReviewQueue(getBookAdaptiveReviewDailyLimit(reviewBook), {
      bookId: safeBookId,
      shuffleDue: getBookAdaptiveReviewShuffleDue(reviewBook),
      minimumDueItemCount: reviewSummary?.dueNow,
    });
    if (result?.ok) {
      trackEvent("adaptive_review_started", {
        book_id: safeBookId,
        due_now: Math.max(0, Math.floor(Number(result?.payload?.stats?.dueNow) || 0)),
      });
    }
  }, [adaptiveReviewBookSummaries, loadAdaptiveReviewQueue, openAdaptiveReviewSelect]);

  function openAdaptiveReviewSettings(bookId) {
    const safeBookId = String(bookId || "").trim();
    if (!safeBookId) return;
    setSelectedAdaptiveReviewBookId(safeBookId);
    setScreen("adaptiveReviewSettings");
  }

  function updateAdaptiveReviewDisplaySetting(bookId, side, key, checked) {
    const safeBookId = String(bookId || "").trim();
    const safeSide = side === "back" ? "back" : "front";
    if (!safeBookId || !ADAPTIVE_REVIEW_DISPLAY_ATTRIBUTE_KEYS.includes(key)) return;

    setBooks((prevBooks) =>
      prevBooks.map((book) => {
        if (String(book.id) !== safeBookId) return book;

        const currentSettings = sanitizeAdaptiveReviewDisplaySettings(
          book.adaptiveReviewDisplaySettings
        );
        return {
          ...book,
          adaptiveReviewDisplaySettings: {
            ...currentSettings,
            [safeSide]: {
              ...currentSettings[safeSide],
              [key]: Boolean(checked),
            },
          },
        };
      })
    );
  }

  function updateBookAdaptiveReviewDailyLimit(bookId, value) {
    const safeBookId = String(bookId || "").trim();
    if (!safeBookId) return;
    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        String(book.id) === safeBookId
          ? {
              ...book,
              adaptiveReviewDailyLimit: parseAdaptiveReviewDailyLimit(value),
            }
          : book
      )
    );
  }

  function updateBookAdaptiveReviewShuffleDue(bookId, checked) {
    const safeBookId = String(bookId || "").trim();
    if (!safeBookId) return;
    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        String(book.id) === safeBookId
          ? {
              ...book,
              adaptiveReviewShuffleDue: Boolean(checked),
            }
          : book
      )
    );
  }

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
    const remainingCount = Math.max(0, adaptiveReviewItems.length - 1);
    const shouldReloadQueueAfterSave = adaptiveReviewItems.length <= 1;

    setAdaptiveReviewError("");
    setAdaptiveReviewItems((prev) => {
      const firstItem = prev[0];
      return firstItem && getAdaptiveReviewItemKey(firstItem) === itemKey ? prev.slice(1) : prev;
    });
    setAdaptiveReviewStats((prev) => ({
      dueNow: Math.max(0, (Number(prev?.dueNow) || 0) - 1),
      newDueNow: Math.max(
        0,
        (Number(prev?.newDueNow) || 0) - (currentItem?.lastReviewedAt ? 0 : 1)
      ),
      reviewDueNow: Math.max(
        0,
        (Number(prev?.reviewDueNow) || 0) - (currentItem?.lastReviewedAt ? 1 : 0)
      ),
    }));

    try {
      if (!authToken && isLocalFallbackItem) {
        recordQuizQuestionCompleted({
          sourceBookId: currentItem.bookId,
          sourceChapterId: currentItem.chapterId,
          word: currentItem.word,
        });
        adaptiveReviewCompletedItemKeysRef.current.add(itemKey);
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
          adaptiveReviewCompletedItemKeysRef.current.add(itemKey);
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
      adaptiveReviewCompletedItemKeysRef.current.add(itemKey);
      trackEvent("adaptive_review_rated", {
        rating,
        remaining_count: remainingCount,
      });

      if (authUsername && !hasFirstReview) {
        setHasFirstReview(true);
        localStorage.setItem(getFirstReviewDoneKey(authUsername), "1");
        if (shouldReloadQueueAfterSave) setJustCompletedFirstReview(true);
      }

      if (shouldReloadQueueAfterSave && !isLocalFallbackItem) {
        const reviewBook = latestBooksRef.current.find((book) => String(book?.id) === String(currentItem.bookId));
        await loadAdaptiveReviewQueue(getBookAdaptiveReviewDailyLimit(reviewBook), {
          silent: true,
          bookId: currentItem.bookId,
          shuffleDue: getBookAdaptiveReviewShuffleDue(reviewBook),
        });
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
      <LoadingAnimation className="accountSyncScreen" label={uiText.loadingAccountData} />
    ) : content;

    const stopGuidedTourForSidebarNavigation = () => {};

    return (
      <div className={`appShell ${guidedTourStep && !isOnboardingTutorialOpen ? "isGuidedLocked" : ""} ${isGuidedModalOpen ? "hasGuidedModalOpen" : ""} ${isGuidedTourMobile && guidedTourStep && !isOnboardingTutorialOpen ? "hasMobileTourBanner" : ""}`}>
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
              <img
                src={theme === "dark" ? "/vocab-logo-light-icon.png" : "/vocab-logo-black.png"}
                className="sidebarToggleLogo"
                alt=""
                aria-hidden="true"
              />
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
          {renderMobileTourBanner()}
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
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextAuthToken);
        setAuthToken(nextAuthToken);
      } else {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setAuthToken(COOKIE_SESSION_AUTH_MARKER);
      }
      const prevUsername = localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || "";
      if (prevUsername && prevUsername !== nextUsername) {
        // Different account — discard the previous user's local timestamp so the
        // cloud state is always applied and never overwritten by stale local data.
        localStorage.removeItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY);
      }
      localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, nextUsername);
      setIsAuthSessionResolved(true);
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
    setIsStripeAnnualConfigured(false);
    setIsStripeLifetimeConfigured(false);
    setIsAccountProfileLoading(false);
    setAccountActionError("");
    setIsChangePasswordModalOpen(false);
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
    const requestAuthToken = authToken;
    setIsAccountProfileLoading(true);
    try {
      const response = await fetchWithRetry(`${AUTH_API_PATH}/account`, {
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        if (!isCurrentAuthRequest(requestAuthToken)) return;
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
    const requestAuthToken = authToken;
    setIsBillingStatusLoading(true);
    try {
      const response = await fetchWithRetry(`${BILLING_API_PATH}/status`, {
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        if (!isCurrentAuthRequest(requestAuthToken)) return;
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
      setIsStripeAnnualConfigured(Boolean(payload?.isStripeAnnualConfigured));
      setIsStripeLifetimeConfigured(Boolean(payload?.isStripeLifetimeConfigured));
    } finally {
      setIsBillingStatusLoading(false);
    }
  }, [authToken]);

  async function startBillingCheckout(billingInterval = "monthly") {
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
        body: JSON.stringify({ billingInterval }),
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
      setIsStripeAnnualConfigured(false);
      setIsStripeLifetimeConfigured(false);
      setIsChangePasswordModalOpen(false);
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
      try {
        const response = await fetchWithRetry(STATE_API_PATH, {
          credentials: "include",
          headers: buildAuthHeaders(authToken),
        });

        if (response.status === 401) {
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
        if (!cancelled) {
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
    const requestAuthToken = authToken;

    const timeoutId = window.setTimeout(() => {
      fetchWithRetry(STATE_API_PATH, {
        method: "PUT",
        credentials: "include",
        headers: buildAuthHeaders(authToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          clientUpdatedAt: localStorage.getItem(LOCAL_STATE_UPDATED_AT_STORAGE_KEY) || undefined,
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
          if (!isCurrentAuthRequest(requestAuthToken)) return;
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
    const prefill = guidedTourStep === "dashboard-add-book" ? (ONBOARDING_GOAL_BOOK_NAMES[onboardingGoal] || "") : "";
    setNewBookName(prefill);
    setNewBookLanguageMode(parseBookLanguageMode(dictionaryPreference, DEFAULT_BOOK_LANGUAGE_MODE));
    setIsAddBookModalOpen(true);
    if (guidedTourStep === "dashboard-add-book") {
      setGuidedTourStep(prefill.trim() ? "book-create" : "book-name");
    }
  }

  function closeAddBookModal() {
    setIsAddBookModalOpen(false);
    if (guidedTourStep === "book-name" || guidedTourStep === "book-create") {
      setGuidedTourStep("dashboard-add-book");
    }
  }

  function createBook() {
    const name = newBookName.trim();
    if (!name) return;
    const duplicateBookName = books.some(
      (book) => normalizeBookNameForComparison(book?.name) === normalizeBookNameForComparison(name)
    );
    if (duplicateBookName) {
      openNoticeModal(
        tr("A book with that name already exists.", "同じ名前のブックが既にあります。"),
        tr("Duplicate Book", "重複ブック")
      );
      return;
    }
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
    trackEvent("book_created", { language_mode: newBook.languageMode });
    setCurrentBookId(newBook.id);
    setScreen("bookMenu");
    setIsAddBookModalOpen(false);
    setNewBookName("");
    setNewBookLanguageMode(parseBookLanguageMode(dictionaryPreference, DEFAULT_BOOK_LANGUAGE_MODE));
    if (guidedTourStep === "book-create" || guidedTourStep === "book-name") {
      setGuidedTourStep("book-definitions");
    }
  }

  async function importJapaneseStarterBook() {
    const existingStarterBook = books.find(
      (book) => String(book?.starterBookId || "") === JAPANESE_STARTER_BOOK_META.id
    );
    if (existingStarterBook) {
      setCurrentBookId(existingStarterBook.id);
      setScreen("bookMenu");
      openNoticeModal(
        tr("The Japanese starter book is already in your library.", "日本語スターターブックはすでにライブラリにあります。"),
        tr("Starter Book Already Imported", "スターターブックはインポート済み")
      );
      return;
    }

    const { JAPANESE_STARTER_BOOK } = await import("./data/japaneseStarterBook.js");
    const now = Date.now();
    const usedNames = new Set(books.map((book) => normalizeBookNameForComparison(book?.name)));
    const importedBook = ensureBookChapters({
      id: `starter-${JAPANESE_STARTER_BOOK.id}-${now}`,
      starterBookId: JAPANESE_STARTER_BOOK.id,
      starterBookSourceName: JAPANESE_STARTER_BOOK.sourceName,
      starterBookSourceUrl: JAPANESE_STARTER_BOOK.sourceUrl,
      starterBookSourceLicense: JAPANESE_STARTER_BOOK.sourceLicense,
      starterBookSourceAttribution: JAPANESE_STARTER_BOOK.sourceAttribution,
      name: makeUniqueBookName(JAPANESE_STARTER_BOOK.name, usedNames),
      languageMode: JAPANESE_STARTER_BOOK.languageMode,
      chapters: JAPANESE_STARTER_BOOK.chapters,
      words: JAPANESE_STARTER_BOOK.words,
      questionsCompleted: 0,
      lastOpened: now,
    });

    setBooks([...books, importedBook]);
    setCurrentBookId(importedBook.id);
    setScreen("bookMenu");
    openNoticeModal(
      tr(
        `${JAPANESE_STARTER_BOOK.words.length} starter words imported. Adaptive Review starts with ${JAPANESE_STARTER_BOOK.initialAdaptiveReviewActiveCount} words so it stays manageable.`,
        `${JAPANESE_STARTER_BOOK.words.length}語をインポートしました。負担を避けるため、適応型復習は最初の${JAPANESE_STARTER_BOOK.initialAdaptiveReviewActiveCount}語から始まります。`
      ),
      tr("Starter Book Imported", "スターターブックをインポートしました")
    );
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
    const duplicateBookName = books.some(
      (book) =>
        book.id !== bookPendingRename.id &&
        normalizeBookNameForComparison(book?.name) === normalizeBookNameForComparison(nextName)
    );
    if (duplicateBookName) {
      openNoticeModal(
        tr("A book with that name already exists.", "同じ名前のブックが既にあります。"),
        tr("Duplicate Book", "重複ブック")
      );
      return;
    }

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
    const hasImportedStreak =
      rawData?.streak && typeof rawData.streak === "object" && !Array.isArray(rawData.streak);
    const importedStreak = hasImportedStreak
      ? parseStoredStreak(JSON.stringify(rawData.streak))
      : null;
    const importedSidebarHidden = parseStoredBoolean(rawData?.isSidebarHidden, false);
    const importedWeeklyStats = parseStoredWeeklyStats(JSON.stringify(rawData?.weeklyStats || null));
    const importedActivityHistory = parseStoredActivityHistory(
      JSON.stringify(rawData?.activityHistory || {})
    );
    const importedFreeDailyUsage = ensureCurrentFreeDailyUsage(rawData?.freeDailyUsage);
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
    setStreak((prev) => choosePreferredStreak(prev, importedStreak));
    setIsSidebarHidden(importedSidebarHidden);
    setWeeklyStats(importedWeeklyStats);
    setActivityHistory(importedActivityHistory);
    setFreeDailyUsage(importedFreeDailyUsage);
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
      applyAppDataSnapshot(rawData, { screenAfterApply: "dashboard" });
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
    trackEvent("onboarding_intro_completed");
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
        stepLabel: tr("Step 1 of 3", "Step 1 of 3"),
        title: tr("Create your first book", "Create your first book"),
        body: tr("Tap the + button to get started.", "Tap the + button to get started."),
      };
    }

    if (guidedTourStep === "book-name") {
      return {
        key: "book-name",
        stepLabel: tr("Step 1 of 3", "Step 1 of 3"),
        title: tr("Name your book", "Name your book"),
        body: tr("Give it a short name, then choose the language direction.", "Give it a short name, then choose the language direction."),
      };
    }

    if (guidedTourStep === "book-create") {
      return {
        key: "book-create",
        stepLabel: tr("Step 1 of 3", "Step 1 of 3"),
        title: tr("Save the book", "Save the book"),
        body: tr("Hit Create to save and move on.", "Hit Create to save and move on."),
      };
    }

    if (guidedTourStep === "book-definitions") {
      return {
        key: "book-definitions",
        stepLabel: tr("Step 2 of 3", "Step 2 of 3"),
        title: tr("Open Definitions", "Open Definitions"),
        body: tr("This is where you add words to your book.", "This is where you add words to your book."),
      };
    }

    if (guidedTourStep === "word-type") {
      return {
        key: "word-type",
        stepLabel: tr("Step 2 of 3", "Step 2 of 3"),
        title: tr(needsMoreWords ? "Type a word to save" : "Words are ready", needsMoreWords ? "Type a word to save" : "Words are ready"),
        body: tr(
          needsMoreWords
            ? `Add ${2 - wordCount} more word${2 - wordCount === 1 ? "" : "s"} — the quiz needs at least two.`
            : "You have enough words to start a quiz.",
          needsMoreWords
            ? `Add ${2 - wordCount} more word${2 - wordCount === 1 ? "" : "s"} — the quiz needs at least two.`
            : "You have enough words to start a quiz."
        ),
      };
    }

    if (guidedTourStep === "word-add") {
      return {
        key: "word-add",
        stepLabel: tr("Step 2 of 3", "Step 2 of 3"),
        title: tr("Press + to save it", "Press + to save it"),
        body: tr("Vocalibry fetches the definition automatically.", "Vocalibry fetches the definition automatically."),
      };
    }

    if (guidedTourStep === "word-saving") {
      return {
        key: "word-saving",
        stepLabel: tr("Step 2 of 3", "Step 2 of 3"),
        title: tr("Saving…", "Saving…"),
        body: tr("Fetching the definition now.", "Fetching the definition now."),
      };
    }

    if (guidedTourStep === "definitions-back") {
      return {
        key: "definitions-back",
        stepLabel: tr("Step 3 of 3", "Step 3 of 3"),
        title: tr("Back to the book menu", "Back to the book menu"),
        body: tr("Press the back button to get to the quiz.", "Press the back button to get to the quiz."),
      };
    }

    if (guidedTourStep === "book-adaptive") {
      return {
        key: "book-adaptive",
        stepLabel: tr("Step 3 of 3", "Step 3 of 3"),
        title: tr("Open Adaptive Review", "Open Adaptive Review"),
        body: tr("Review the words you just saved.", "Review the words you just saved."),
      };
    }










    return null;
  }

  function renderGuidedTourCoach(placement = "floating", targetKey = "") {
    const guidedStep = getGuidedTourStep();
    if (!guidedStep || isOnboardingTutorialOpen) return null;
    if (targetKey && guidedStep.key !== targetKey) return null;
    if (!targetKey && screen === "dashboard" && guidedStep.key === "dashboard-add-book") return null;
    if (!targetKey && screen === "bookMenu" && (guidedStep.key === "book-definitions" || guidedStep.key === "book-adaptive")) return null;
    if (!targetKey && screen === "definitions" && ["word-type", "word-add", "word-saving", "definitions-back"].includes(guidedStep.key)) return null;
    if (!targetKey && isAddBookModalOpen && ["book-name", "book-create"].includes(guidedStep.key)) return null;


    return (
      <aside className={`guidedCoach guidedCoach-${guidedStep.key} guidedCoach-${placement}`} aria-live="polite">
        <div className="guidedCoachTopRow">
          <span className="guidedCoachStep">{guidedStep.stepLabel}</span>
        </div>
        <h2>{guidedStep.title}</h2>
        <p>{guidedStep.body}</p>
      </aside>
    );
  }

  function renderMobileTourBanner() {
    if (!isGuidedTourMobile) return null;
    const guidedStep = getGuidedTourStep();
    if (!guidedStep || isOnboardingTutorialOpen) return null;
    return (
      <div className="mobileTourBanner" role="status" aria-live="polite">
        <div className="mobileTourBannerContent">
          <span className="mobileTourBannerStep">{guidedStep.stepLabel}</span>
          <strong className="mobileTourBannerTitle">{guidedStep.title}</strong>
          <p className="mobileTourBannerBody">{guidedStep.body}</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!guidedTourStep) return;
    trackEvent("onboarding_tour_step", { step: guidedTourStep });
  }, [guidedTourStep]);

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
    if (!window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(max-width: 700px)");
    const syncGuidedTourViewport = () => setIsGuidedTourMobile(mediaQuery.matches);

    syncGuidedTourViewport();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncGuidedTourViewport);
      return () => mediaQuery.removeEventListener("change", syncGuidedTourViewport);
    }
    mediaQuery.addListener(syncGuidedTourViewport);
    return () => mediaQuery.removeListener(syncGuidedTourViewport);
  }, []);

  useEffect(() => {
    if (!guidedTourStep) return;

    const timeoutId = window.setTimeout(() => {
      const targetSelector = getGuidedTourTargetSelector(guidedTourStep);
      const target = targetSelector ? document.querySelector(targetSelector) : null;
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: isGuidedTourMobile ? "center" : "nearest",
        inline: "nearest",
      });

      if (guidedTourStep === "word-type" || guidedTourStep === "book-name") {
        target.focus?.({ preventScroll: true });
      }
    }, isGuidedTourMobile ? 180 : 80);

    return () => window.clearTimeout(timeoutId);
  }, [guidedTourStep, screen, isAddBookModalOpen, isGuidedTourMobile]);

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
      trackEvent("onboarding_started", { source: "dev_tutorial" });
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
    trackEvent("onboarding_started", { source: "new_user" });
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
    if (!authUsername) return;
    setIsChecklistDismissed(localStorage.getItem(getChecklistDismissedKey(authUsername)) === "1");
    setHasFirstReview(localStorage.getItem(getFirstReviewDoneKey(authUsername)) === "1");
    setHasCompletedGuidedTour(localStorage.getItem(getGuidedTourDoneKey(authUsername)) === "1");
  }, [authUsername]);

  useEffect(() => {
    if (justCompletedFirstReview && adaptiveReviewItems.length === 0 && !adaptiveReviewLoading) {
      setShowFirstReviewCelebration(true);
      setJustCompletedFirstReview(false);
    }
  }, [justCompletedFirstReview, adaptiveReviewItems.length, adaptiveReviewLoading]);

  useEffect(() => {
    const isModalOpen =
      isOnboardingTutorialOpen ||
      isAddBookModalOpen ||
      isChangePasswordModalOpen ||
      Boolean(accountPanelModal) ||
      Boolean(bookPendingRename) ||
      Boolean(bookPendingDelete) ||
      Boolean(chapterPendingDelete) ||
      isAdaptiveReviewInfoOpen ||
      Boolean(noticeModal);
    if (!isModalOpen) return;

    const closeModal = () => {
      if (guidedTourStep) {
        if (noticeModal) setNoticeModal(null);
        return;
      }
      if (isOnboardingTutorialOpen) { completeOnboardingTutorial(); return; }
      if (isAddBookModalOpen) setIsAddBookModalOpen(false);
      if (isChangePasswordModalOpen) setIsChangePasswordModalOpen(false);
      if (accountPanelModal) setAccountPanelModal("");
      if (bookPendingRename) setBookPendingRename(null);
      if (bookPendingDelete) setBookPendingDelete(null);
      if (chapterPendingDelete) setChapterPendingDelete(null);
      if (isAdaptiveReviewInfoOpen) setIsAdaptiveReviewInfoOpen(false);
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
    bookPendingRename,
    bookPendingDelete,
    chapterPendingDelete,
    isAdaptiveReviewInfoOpen,
    isDeleteAccountConfirmOpen,
    noticeModal,
    completeOnboardingTutorial,
    guidedTourStep,
  ]);

  function renderGettingStartedChecklist() {
    if (isChecklistDismissed) return null;
    const totalWords = books.reduce((sum, b) => sum + (b.words?.length || 0), 0);
    const items = [
      { key: "account", label: tr("Created your account", "アカウント作成"), done: true },
      { key: "book", label: tr("Create your first book", "最初のブックを作成"), done: books.length > 0 },
      { key: "words", label: tr("Add 5 words", "5語を追加"), done: totalWords >= 5 },
      { key: "review", label: tr("Complete a review session", "復習セッションを完了"), done: hasFirstReview },
    ];
    if (items.every((i) => i.done)) return null;
    return (
      <div className="gettingStartedChecklist">
        <div className="gettingStartedHeader">
          <strong>{tr("Getting Started", "はじめに")}</strong>
          <button
            type="button"
            className="gettingStartedDismiss"
            aria-label={tr("Dismiss", "閉じる")}
            onClick={() => {
              setIsChecklistDismissed(true);
              if (authUsername) localStorage.setItem(getChecklistDismissedKey(authUsername), "1");
            }}
          >
            ×
          </button>
        </div>
        <ul className="gettingStartedList">
          {items.map(({ key, label, done }) => (
            <li key={key} className={`gettingStartedItem ${done ? "done" : ""}`}>
              <span className="gettingStartedCheck" aria-hidden="true">{done ? "✓" : "○"}</span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function renderModal() {
  if (showPostTourSheet) {
    return (
      <div className="modalOverlay">
        <div
          className="modalCard postTourSheetCard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-tour-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="post-tour-title">{tr("You're all set!", "準備完了！")}</h3>
          <p>
            {tr(
              "Vocalibry schedules each word for the exact moment before you'd forget it. The more you review, the longer the gaps between sessions — until words are locked in for good.",
              "Vocalibryは、忘れる直前のタイミングに合わせて各単語をスケジュールします。復習を重ねるほど間隔が広がり、やがて単語が完全に定着します。"
            )}
          </p>
          <p className="settingsHint">
            {tr(
              "Check back tomorrow — your words will be ready for their first scheduled review.",
              "明日また来てみましょう — 最初の予定復習が準備されます。"
            )}
          </p>
          <div className="modalActions">
            <button
              type="button"
              className="modalBtn primary"
              onClick={() => {
                setShowPostTourSheet(false);
                openAdaptiveReviewSession(currentBook?.id, { backScreen: "bookMenu" });
              }}
            >
              {tr("Got it, start review →", "わかった、復習を始める →")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showFirstReviewCelebration) {
    return (
      <div className="modalOverlay">
        <div
          className="modalCard postTourSheetCard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-review-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="first-review-title">{tr("First review done!", "初めての復習完了！")}</h3>
          <p>
            {tr(
              "These words are now scheduled using spaced repetition. The more you review, the longer they stay — until they become permanent memory.",
              "これらの単語は間隔反復でスケジュールされました。復習を重ねるほど記憶が長続きし、やがて永久記憶になります。"
            )}
          </p>
          <div className="modalActions">
            <button
              type="button"
              className="modalBtn primary"
              onClick={() => {
                setShowFirstReviewCelebration(false);
                setScreen("gallery");
              }}
            >
              {tr("See my words →", "単語を見る →")}
            </button>
            <button
              type="button"
              className="modalBtn ghost"
              onClick={() => setShowFirstReviewCelebration(false)}
            >
              {tr("Close", "閉じる")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isOnboardingTutorialOpen) {
    return (
      <div className="modalOverlay tutorialOverlay" onClick={completeOnboardingTutorial}>
        <div
          className="modalCard tutorialModalCard"
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-tutorial-title"
          onClick={(e) => e.stopPropagation()}
        >
          {onboardingTutorialStep === 0 ? (
            <>
              <div className="tutIntroTop">
                <img src="/vocab-logo-black.png" alt="" className="tutIntroLogo" aria-hidden="true" />
                <h2 id="onboarding-tutorial-title" className="tutIntroHeadline">{ONBOARDING_TUTORIAL_SLIDE.title}</h2>
                <p className="tutIntroBody">{ONBOARDING_TUTORIAL_SLIDE.body}</p>
                <ol className="tutStepList">
                  {ONBOARDING_TUTORIAL_SLIDE.steps.map(({ n, label, detail }) => (
                    <li key={n} className="tutStep">
                      <span className="tutStepNum" aria-hidden="true">{n}</span>
                      <div className="tutStepText">
                        <span className="tutStepLabel">{label}</span>
                        <span className="tutStepDetail">{detail}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <button type="button" className="tutStartBtn" onClick={() => setOnboardingTutorialStep(1)}>
                {tr("Get started", "始める")} →
              </button>
            </>
          ) : (
            <>
              <div className="tutGoalStep">
                <h2 id="onboarding-tutorial-title" className="tutIntroHeadline">{tr("What are you learning?", "学習の目的は？")}</h2>
                <p className="tutIntroBody">{tr("We'll tailor your first book to match.", "目標に合わせて最初のブックを設定します。")}</p>
                <div className="tutGoalPills" role="group" aria-label={tr("Learning goal", "学習目標")}>
                  {ONBOARDING_GOAL_OPTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`tutGoalPill ${onboardingGoal === id ? "selected" : ""}`}
                      onClick={() => {
                        setOnboardingGoal(id);
                        localStorage.setItem(ONBOARDING_GOAL_STORAGE_KEY, id);
                        trackEvent("onboarding_goal_selected", { goal: id });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="tutStartBtn" onClick={startGuidedDashboardTour}>
                {tr("Start guided tour", "ツアーを始める")}
              </button>
              <button type="button" className="tutSkipLink" onClick={() => setOnboardingTutorialStep(0)}>
                ← {tr("Back", "戻る")}
              </button>
            </>
          )}
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
                {billingPlan === "pro" && !isLifetimePro ? (
                  <>
                    {!isStripeBillingConfigured ? (
                      <p className="settingsHint">
                        {tr("Stripe billing is not configured yet. Add Stripe env vars on the backend.", "Stripe請求が未設定です。バックエンドで環境変数を設定してください。")}
                      </p>
                    ) : null}
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
                  </>
                ) : billingPlan === "pro" ? (
                  <p className="settingsHint">{tr("Your plan is lifetime Pro. Billing management is not required.", "永久Proのため請求管理は不要です。")}</p>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button
                        type="button"
                        className="primaryBtn"
                        style={{
                          flex: 1,
                          ...(selectedBillingInterval === "annual"
                            ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" }
                            : {}),
                        }}
                        onClick={() => setSelectedBillingInterval("annual")}
                      >
                        {tr("Annual · A$48/yr", "年間 · A$48/yr")}
                      </button>
                      <button
                        type="button"
                        className="primaryBtn"
                        style={{
                          flex: 1,
                          ...(selectedBillingInterval === "monthly"
                            ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" }
                            : {}),
                        }}
                        onClick={() => setSelectedBillingInterval("monthly")}
                      >
                        {tr("Monthly · A$6/mo", "月額 · A$6/mo")}
                      </button>
                    </div>
                    <p className="settingsHint" style={{ marginTop: 6, marginBottom: 4 }}>
                      {selectedBillingInterval === "annual"
                        ? tr("Billed upfront — saves 33% vs monthly.", "年間前払い — 月額比33%オフ。")
                        : tr("Billed monthly, cancel anytime.", "毎月請求、いつでもキャンセル可。")}
                    </p>
                    {isStripeLifetimeConfigured ? (
                      <button
                        type="button"
                        className="primaryBtn"
                        style={{
                          width: "100%",
                          marginBottom: 4,
                          ...(selectedBillingInterval === "lifetime"
                            ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" }
                            : {}),
                        }}
                        onClick={() => setSelectedBillingInterval("lifetime")}
                      >
                        {tr("Lifetime · A$99 (limited)", "永久ライセンス · A$99（限定）")}
                      </button>
                    ) : null}
                    {!isSelectedIntervalConfigured ? (
                      <p className="settingsHint">
                        {tr("Stripe billing is not configured yet. Add Stripe env vars on the backend.", "Stripe請求が未設定です。バックエンドで環境変数を設定してください。")}
                      </p>
                    ) : null}
                    <div className="settingsRow">
                      <span>
                        {PREMIUM_UPGRADE_ENABLED
                          ? tr("Upgrade account", "アカウントをアップグレード")
                          : tr("Pro coming soon", "Proは近日公開")}
                      </span>
                      <button
                        type="button"
                        className="primaryBtn"
                        onClick={() => startBillingCheckout(selectedBillingInterval)}
                        disabled={
                          !PREMIUM_UPGRADE_ENABLED ||
                          isBillingCheckoutSubmitting ||
                          !isSelectedIntervalConfigured ||
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
                    {!PREMIUM_UPGRADE_ENABLED ? (
                      <p className="settingsHint">{tr("Pro coming soon.", "Proは近日公開です。")}</p>
                    ) : null}
                  </>
                )}
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

    if (isAdaptiveReviewInfoOpen) {
      return (
        <div className="modalOverlay" onClick={() => setIsAdaptiveReviewInfoOpen(false)}>
          <div
            className="modalCard adaptiveReviewInfoModal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adaptive-review-info-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="adaptive-review-info-title">{tr("How Adaptive Review Works", "適応型復習の使い方")}</h3>
            <p className="adaptiveReviewInfoIntro">
              {tr(
                "Adaptive Review turns a long vocabulary list into a daily memory system. Instead of rereading everything or guessing what to study, it gives you the words most likely to matter today: a controlled number of new words plus older words that are ready to be strengthened.",
                "適応型復習は、長い単語リストを毎日の記憶システムに変えます。全部を読み直したり、何を勉強するか迷ったりせず、今日必要な単語だけを出します。無理のない数の新出単語に、定着させるべき復習済み単語を加えます。"
              )}
            </p>
            <div className="adaptiveReviewInfoSections">
              <section>
                <h4>{tr("Why spaced repetition helps", "間隔反復が役立つ理由")}</h4>
                <p>
                  {tr(
                    "Most forgetting happens because a word is seen once, feels familiar, and then disappears for too long. Spaced repetition deliberately brings it back after a delay, forcing active recall. That recall effort is what makes the memory stronger.",
                    "多くの単語は、一度見て分かった気になったあと、長く出会わないことで忘れてしまいます。間隔反復は、少し時間を空けて単語を戻し、能動的に思い出す機会を作ります。この思い出す努力が記憶を強くします。"
                  )}
                </p>
                <p>
                  {tr(
                    "The benefit is efficiency: easy words stop wasting your time, while weak words get more attention before they vanish.",
                    "利点は効率です。簡単な単語に時間を使いすぎず、弱い単語には忘れる前に多めの注意を向けられます。"
                  )}
                </p>
              </section>
              <section>
                <h4>{tr("Reading the dashboard counters", "ダッシュボードのカウンター")}</h4>
                <p>
                  {tr(
                    "Due is the total ready now. New is unseen words introduced today. Reviews are words you have seen before whose review date has arrived.",
                    "Dueは今すぐ復習できる合計です。Newは今日導入される未学習単語です。Reviewsは以前見た単語で、復習日が来たものです。"
                  )}
                </p>
                <div className="adaptiveReviewInfoExample">
                  {tr("Example: 20 New + 7 Reviews = 27 Due.", "例: New 20 + Reviews 7 = Due 27。")}
                </div>
              </section>
              <section>
                <h4>{tr("How to run a review session", "復習セッションの進め方")}</h4>
                <p>
                  {tr(
                    "Use it as a short daily habit. The goal is not to stare at cards until they feel familiar; the goal is to test recall, reveal the answer, and let the scheduler decide when each word should return.",
                    "短い毎日の習慣として使います。カードを眺めて見慣れることが目的ではありません。思い出せるか試し、答えを確認し、次にいつ戻すかをスケジューラーに任せます。"
                  )}
                </p>
                <ul>
                  <li>{tr("Look at the prompt and pause before revealing.", "表示された内容を見て、答えを出してから表示します。")}</li>
                  <li>{tr("Use the answer side to check meaning, reading, example, or chapter context.", "答え側で意味、読み、例文、章の文脈を確認します。")}</li>
                  <li>{tr("Rate recall, not effort. The rating controls when the word returns.", "努力ではなく思い出せた度合いで評価します。評価が次回表示時期を決めます。")}</li>
                </ul>
              </section>
              <section>
                <h4>{tr("What the ratings mean", "評価の意味")}</h4>
                <p>
                  {tr(
                    "Honest ratings make the system smarter. If you mark everything Easy, weak words disappear too soon. If you mark everything Again, your queue becomes heavier than it needs to be.",
                    "正直な評価ほどシステムは賢くなります。すべてEasyにすると弱い単語が早く消えすぎます。すべてAgainにすると必要以上に復習量が重くなります。"
                  )}
                </p>
                <ul>
                  <li>{tr("Again: you missed it; bring it back soon.", "Again: 間違えたので早めに戻します。")}</li>
                  <li>{tr("Hard: you got it, but it was slow or uncertain.", "Hard: 分かったが遅い、または不安定でした。")}</li>
                  <li>{tr("Good: you remembered it clearly.", "Good: はっきり思い出せました。")}</li>
                  <li>{tr("Easy: it felt automatic, so it can wait longer.", "Easy: 自然に出たので、次回まで長めに空けます。")}</li>
                </ul>
              </section>
              <section>
                <h4>{tr("Using settings", "設定の使い方")}</h4>
                <p>
                  {tr(
                    "Press the gear on a book card to choose New words per day, shuffle due words, and control which attributes appear on the front and back of review cards.",
                    "ブックカードの歯車から、1日の新出単語数、期限単語のシャッフル、カード表裏に表示する項目を設定できます。"
                  )}
                </p>
                <ul>
                  <li>{tr("New words per day controls intake, not total workload.", "1日の新出単語数は、総復習数ではなく新しい単語の導入数を管理します。")}</li>
                  <li>{tr("Due review words are added on top of new words.", "期限が来た復習済み単語は、新出単語に追加されます。")}</li>
                  <li>{tr("Card display settings let you choose what appears before and after reveal.", "カード表示設定で、答え表示前後に見せる項目を選べます。")}</li>
                </ul>
                <p>
                  {tr(
                    "A good starting point is 10-20 new words per day. Increase it only if you can also keep up with the reviews that come back later.",
                    "最初は1日10〜20語がおすすめです。あとで戻ってくる復習にも対応できる場合だけ増やしましょう。"
                  )}
                </p>
              </section>
              <section>
                <h4>{tr("Large premade books", "大きな既成ブック")}</h4>
                <p>
                  {tr(
                    "For a 1.5k-word book, Adaptive Review will not dump every word into one session. If New words per day is 20, it introduces up to 20 unseen words per day, plus any older words that are due.",
                    "1,500語のブックでも、全単語を一度に出すことはありません。1日の新出単語数が20なら、未学習単語は1日最大20語まで導入され、期限が来た復習済み単語が追加されます。"
                  )}
                </p>
                <p>
                  {tr(
                    "This is what makes big decks usable: you get a steady path through the book without turning the first week into a giant backlog.",
                    "これにより、大きな単語集でも現実的に使えます。最初の1週間で巨大な未消化リストを作るのではなく、毎日少しずつ進められます。"
                  )}
                </p>
              </section>
            </div>
            <div className="modalActions">
              <button type="button" className="modalBtn primary" onClick={() => setIsAdaptiveReviewInfoOpen(false)}>
                {tr("Got it", "OK")}
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
    setQuizSetupStep(2);
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
      trackEvent("word_limit_reached", { word_count: totalSavedWordCount });
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
      lookupSucceeded = true;

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
                  exampleSentence: "",
                  exampleTranslation: "",
                  exampleProvider: "",
                  exampleFurigana: [],
                  examplePending: true,
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
      trackEvent("word_added", {
        language_mode: currentBookLanguageMode,
        is_first_word: totalSavedWordCount === 0,
      });
      latestBooksRef.current = updatedBooks;
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
      void loadAdaptiveReviewSummary({ silent: true, books: updatedBooks });
      void fetchExampleSentence({
        word: savedWord,
        definitions,
        languageMode: currentBookLanguageMode,
      }).then((exampleResult) => {
        const exampleSentence = String(exampleResult?.sentence || "").trim();
        const exampleTranslation = String(exampleResult?.translation || "").trim();
        const exampleProvider = String(exampleResult?.provider || "").trim();
        const exampleFurigana = Array.isArray(exampleResult?.furigana) ? exampleResult.furigana : [];
        setBooks((prevBooks) => {
          let didUpdate = false;
          const nextBooks = prevBooks.map((book) => {
            if (book.id !== currentBookId) return book;
            let didUpdateWord = false;
            const nextWords = book.words.map((wordEntry) => {
              const isTargetWord =
                String(wordEntry?.word || "").trim().toLowerCase() === normalizedSavedWord &&
                (wordEntry?.chapterId || fallbackChapterId) === safeSelectedChapterIdForNewWords;
              if (!isTargetWord || String(wordEntry?.exampleSentence || "").trim()) return wordEntry;
              didUpdate = true;
              didUpdateWord = true;
              return {
                ...wordEntry,
                examplePending: false,
                exampleSentence,
                exampleTranslation,
                exampleProvider,
                exampleFurigana,
              };
            });
            return didUpdateWord ? { ...book, words: nextWords } : book;
          });
          if (didUpdate) {
            latestBooksRef.current = nextBooks;
          }
          return didUpdate ? nextBooks : prevBooks;
        });
      }).catch(() => {
        setBooks((prevBooks) => {
          let didUpdate = false;
          const nextBooks = prevBooks.map((book) => {
            if (book.id !== currentBookId) return book;
            let didUpdateWord = false;
            const nextWords = book.words.map((wordEntry) => {
              const isTargetWord =
                String(wordEntry?.word || "").trim().toLowerCase() === normalizedSavedWord &&
                (wordEntry?.chapterId || fallbackChapterId) === safeSelectedChapterIdForNewWords;
              if (!isTargetWord || !wordEntry?.examplePending) return wordEntry;
              didUpdate = true;
              didUpdateWord = true;
              return {
                ...wordEntry,
                examplePending: false,
              };
            });
            return didUpdateWord ? { ...book, words: nextWords } : book;
          });
          if (didUpdate) {
            latestBooksRef.current = nextBooks;
          }
          return didUpdate ? nextBooks : prevBooks;
        });
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
    if (authUsername && !hasFirstReview) {
      setHasFirstReview(true);
      localStorage.setItem(getFirstReviewDoneKey(authUsername), "1");
    }

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
              {streak.count > 1 && streak.lastDate !== getCurrentDayKey() && adaptiveReviewStats.dueNow > 0 && (
                <p className="streakStatusText">
                  {tr(
                    `${adaptiveReviewStats.dueNow} word${adaptiveReviewStats.dueNow === 1 ? "" : "s"} due — review to keep your streak`,
                    `${adaptiveReviewStats.dueNow}語が期限切れ — ストリークを守るために復習しよう`
                  )}
                </p>
              )}
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
        {(() => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayKey = getCurrentDayKey(yesterday);
          const isReturningAfterAbsence = hasCompletedGuidedTour && streak.lastDate && streak.lastDate < yesterdayKey && adaptiveReviewStats.dueNow > 0 && !reengagementDismissed;
          if (!isReturningAfterAbsence) return null;
          return (
            <div className="reengagementBanner">
              <span className="reengagementBannerText">
                <strong>{tr("Welcome back!", "おかえり！")}</strong>
                <span>{tr(`You have ${adaptiveReviewStats.dueNow} word${adaptiveReviewStats.dueNow === 1 ? "" : "s"} waiting — pick up where you left off.`, `${adaptiveReviewStats.dueNow}語が待っています — 続きから始めましょう。`)}</span>
              </span>
              <div className="reengagementBannerActions">
                <button type="button" className="reengagementReviewBtn" onClick={() => { setReengagementDismissed(true); setScreen("reviewSelect"); }}>
                  {tr("Review now", "今すぐ復習")}
                </button>
                <button type="button" className="reengagementDismissBtn" aria-label={tr("Dismiss", "閉じる")} onClick={() => setReengagementDismissed(true)}>
                  ×
                </button>
              </div>
            </div>
          );
        })()}
        {hasCompletedGuidedTour && adaptiveReviewStats.dueNow > 0 && streak.lastDate !== getCurrentDayKey() && (
          <button
            type="button"
            className="dueWordsCallout"
            onClick={() => setScreen("reviewSelect")}
          >
            <span className="dueWordsCalloutIcon">{"🧠"}</span>
            <span className="dueWordsCalloutText">
              <strong>{tr(`${adaptiveReviewStats.dueNow} word${adaptiveReviewStats.dueNow === 1 ? "" : "s"} ready for review`, `${adaptiveReviewStats.dueNow}語の復習が待っています`)}</strong>
              <span>{tr("Tap to keep your streak going", "タップしてストリークを続けよう")}</span>
            </span>
            <span className="dueWordsCalloutArrow" aria-hidden="true">{"›"}</span>
          </button>
        )}
        <div className="panelGrid dashboardPanelGrid">
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("reviewSelect")}
          >
            <span>{"🎯"} {tr("Review", "復習")}</span>
            {adaptiveReviewStats.dueNow > 0 && (
              <span className="reviewSelectCardBadge">{adaptiveReviewStats.dueNow}</span>
            )}
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("definitionsSelect")}
          >
            <span>{"📘"} {tr("Definitions", "単語追加")}</span>
          </button>
          <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("books")}
          >
            <span>{"\uD83D\uDCDA"} {tr("My Books", "マイブック")}</span>
            <small className="settingsHint">{tr("Manage your word lists", "単語リストを管理")}</small>
          </button>
                    <button
            type="button"
            className="panelCard wide"
            onClick={() => setScreen("gallery")}
          >
            <span>{"✨"} {tr("Vocab Library", "単語ライブラリ")}</span>
            <small className="settingsHint">{tr("Words from your reviews", "復習で出会った単語")}</small>
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
        {renderGettingStartedChecklist()}
        {isGuidedTourDismissed && !guidedTourStep && !hasCompletedGuidedTour && (
          <button
            type="button"
            className="resumeTourBtn"
            onClick={() => {
              setIsGuidedTourDismissed(false);
              setGuidedTourStep("dashboard-add-book");
            }}
          >
            ? {tr("Tour", "ツアー")}
          </button>
        )}
        {renderModal()}
      </div>
    );
  }

  // ---------- REVIEW SELECT ----------
  if (screen === "reviewSelect") {
    return renderWithSidebar(
      <div className="page reviewSelectPage">
        <div className="pageHeader">
          <button className="backBtn" aria-label={tr("Go back", "戻る")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("Review", "復習")}</h1>
        </div>
        <div className="reviewSelectList">
          <button
            type="button"
            className="reviewSelectCard"
            onClick={openAdaptiveReviewSelect}
          >
            <span className="reviewSelectCardIcon">{"🧠"}</span>
            <div className="reviewSelectCardBody">
              <span className="reviewSelectCardTitle">{tr("Adaptive Review", "適応型復習")}</span>
              <span className="reviewSelectCardDesc">{tr("Spaced repetition — focuses on what you are forgetting", "忘れている単語に集中する間隔反復")}</span>
            </div>
            {adaptiveReviewStats.dueNow > 0 && (
              <span className="reviewSelectCardBadge">{adaptiveReviewStats.dueNow}</span>
            )}
          </button>
          <button
            type="button"
            className="reviewSelectCard"
            onClick={() => setScreen("flashcardsSelect")}
          >
            <span className="reviewSelectCardIcon">{"⚡"}</span>
            <div className="reviewSelectCardBody">
              <span className="reviewSelectCardTitle">{tr("Flashcards", "フラッシュカード")}</span>
              <span className="reviewSelectCardDesc">{tr("Flip through words for fast recognition practice", "素早い認識練習のためにカードをめくる")}</span>
            </div>
          </button>
          <button
            type="button"
            className="reviewSelectCard"
            onClick={() => {
              setQuizBackScreen("quizSelect");
              setQuizMode("normal");
              initializeQuizSetupSelection();
              setScreen("quizSelect");
            }}
          >
            <span className="reviewSelectCardIcon">{"✅"}</span>
            <div className="reviewSelectCardBody">
              <span className="reviewSelectCardTitle">{tr("Quiz", "クイズ")}</span>
              <span className="reviewSelectCardDesc">{tr("Test yourself with multiple-choice and typed answers", "選択式・入力式で知識をテスト")}</span>
            </div>
          </button>
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
  // ---------- PREMADE BOOKS ----------
  if (screen === "premadeBooks") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label={tr("Go back", "戻る")} onClick={() => setScreen("books")}>&times;</button>
          <h1>{tr("Premade Books", "既製ブック")}</h1>
        </div>
        <div className="bookGrid selectBookGrid premadeBookGrid">
          {PREMADE_BOOKS.map((premadeBook) => {
            const importedBook = books.find(
              (book) => String(book?.starterBookId || "") === premadeBook.id
            );
            const actionLabel = importedBook
              ? tr("Open Book", "ブックを開く")
              : tr("Import Book", "ブックを読み込む");
            const handleAction = importedBook
              ? () => {
                  setCurrentBookId(importedBook.id);
                  setScreen("bookMenu");
                }
              : importJapaneseStarterBook;

            return (
              <div key={premadeBook.id} className="selectBookCard premadeBookTile">
                <div className="selectBookCardTop">
                  <p className="starterBookEyebrow">
                    {tr(premadeBook.typeLabel, premadeBook.typeLabelJa)}
                  </p>
                  <h3 className="selectBookTitle">{premadeBook.name}</h3>
                  <p className="settingsHint">
                    {tr(
                      `${premadeBook.wordCount} beginner-friendly words across JLPT N5, N4, and an N3 starter top-up.`,
                      `${premadeBook.wordCount}語をJLPT N5、N4、N3入門に分けて収録。`
                    )}
                  </p>
                </div>
                <p className="starterBookAttribution">
                  {tr("Source:", "出典:")}{" "}
                  <a href={premadeBook.sourceUrl} target="_blank" rel="noreferrer">
                    {premadeBook.sourceName}
                  </a>{" "}
                  ({premadeBook.sourceLicense})
                </p>
                <button type="button" className="primaryBtn" onClick={handleAction}>
                  {actionLabel}
                </button>
              </div>
            );
          })}
        </div>
        {renderModal()}
      </div>
    );
  }

  if (screen === "books") {
    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("dashboard")}>&times;</button>
          <h1>{tr("My Books", "マイブック")}</h1>
        </div>
          <>
            <button className="primaryBtn" onClick={openAddBookModal}>+ {tr("Add Book", "ブック追加")}</button>
            <div className="bookGrid selectBookGrid">
              {sortedBooksByRecent.map((book) => renderMyBookCard(book))}
            </div>
          </>
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
              {(currentBook?.words || []).length < 5 && <small className="bookModeStartHere">{tr("← Start here", "← ここから始める")}</small>}
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
          <div className="guidedControlAnchor">
            <button
              type="button"
              className={`panelCard bookModeCard ${guidedTourStep === "book-adaptive" ? "guidedTarget" : ""}`}
              onClick={() => {
                if (guidedTourStep === "book-adaptive") {
                  trackEvent("onboarding_tour_completed");
                  setGuidedTourStep("");
                  setIsGuidedTourDismissed(true);
                  setHasCompletedGuidedTour(true);
                  if (authUsername) localStorage.setItem(getGuidedTourDoneKey(authUsername), "1");
                  setShowPostTourSheet(true);
                  return;
                }
                openAdaptiveReviewSession(currentBook?.id, { backScreen: "bookMenu" });
              }}
            >
              <span className="bookModeIcon" aria-hidden="true">{"🧠"}</span>
              <strong>{tr("Adaptive Review", "適応型復習")}</strong>
              <p>{tr("Review only the due words from this book.", "このブックの復習期限が来た単語だけを練習します。")}</p>
              {(currentBook?.words || []).length >= 2 && <small className="bookModeStartHere">{tr("Your daily study habit", "毎日の学習習慣")}</small>}
            </button>
            {renderGuidedTourCoach("below", "book-adaptive")}
          </div>
          <button
            type="button"
            className="panelCard bookModeCard"
            onClick={() => {
              setQuizBackScreen("bookMenu");
              setQuizMode("normal");
              initializeQuizSetupSelection();
              setScreen("quizSelect");
            }}
          >
            <span className="bookModeIcon" aria-hidden="true">{"✅"}</span>
            <strong>{tr("Quiz", "クイズ")}</strong>
            <p>{tr("Test active recall with normal, typing, or mistake mode.", "通常・タイピング・ミス復習で能動想起を鍛えます。")}</p>
          </button>
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
                  setGuidedTourStep("book-adaptive");
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
        {loading && <LoadingAnimation className="inlineLoadingAnimation" label={tr("Saving word...", "単語を保存中...")} />}
        <div className="wordList">
          {currentBook?.words.map((w, i) => {
            const definitionVariants = getWordDefinitions(w);
            const totalDefinitionVariants = definitionVariants.length;
            const currentDefinitionVariant = Math.min(
              Math.max((w.currentDefinitionIndex ?? 0) + 1, 1),
              Math.max(totalDefinitionVariants, 1)
            );
            const selectedDefinition = getSelectedDefinition(w);
            const wordAudioText =
              currentBookLanguageMode === "ja_en"
                  ? String(w.word || "").trim()
                  : "";
            const rawExampleSentence = String(w.exampleSentence || "").trim();
            const exampleSentence = stripInlineJapaneseReadings(rawExampleSentence);
            const exampleTranslation = String(w.exampleTranslation || "").trim();
            const isExamplePending = Boolean(w.examplePending) && !exampleSentence;

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
                      {wordAudioText ? (
                        <AudioButton
                          text={wordAudioText}
                          language="ja-JP"
                          label={`Play ${w.word}`}
                          className="wordAudioButton"
                        />
                      ) : null}
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
                      <p>
                        <span>{selectedDefinition}</span>
                        {currentBookLanguageMode === "en_ja" && selectedDefinition ? (
                          <AudioButton
                            text={selectedDefinition}
                            language="ja-JP"
                            label={`Play definition for ${w.word}`}
                            className="definitionAudioButton"
                          />
                        ) : null}
                      </p>
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
                  {isExamplePending ? (
                    <div className="exampleList exampleListLoading" aria-label={tr("Loading example sentence", "例文を読み込み中")}>
                      <div className="exampleLoadingLine"></div>
                      <div className="exampleLoadingLine short"></div>
                    </div>
                  ) : exampleSentence ? (
                    <div className="exampleList">
                      <p className={`exampleItem ${currentBookLanguageMode !== "en_en" ? "isJapaneseText" : ""}`}>
                        {currentBookLanguageMode !== "en_en" ? (
                          <JapaneseExampleSentence sentence={rawExampleSentence} wordEntry={w} />
                        ) : (
                          exampleSentence
                        )}{" "}
                        {currentBookLanguageMode !== "en_en" ? (
                          <AudioButton
                            text={exampleSentence}
                            language="ja-JP"
                            label={`Play example sentence for ${w.word}`}
                            className="exampleAudioButton"
                          />
                        ) : null}
                      </p>
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
    const typeStepIndex = 0;
    const contentStepIndex = 1;
    const reviewStepIndex = 2;
    const stepTitles = [
      tr("Quiz Type", "クイズ種類"),
      tr("Content", "コンテンツ"),
      tr("Review", "確認"),
    ];
    const isAtTypeStep = quizSetupStep === typeStepIndex;
    const isAtContentStep = quizSetupStep === contentStepIndex;
    const isAtReviewStep = quizSetupStep === reviewStepIndex;
    const canMoveForward =
      isAtTypeStep ||
      (isAtContentStep && selectedBookCount > 0 && selectedChapterCount > 0);
    const nextStepHint =
      isAtContentStep && selectedBookCount === 0
        ? tr("Select at least one book to continue.", "続行するには1冊以上選択してください。")
        : isAtContentStep && selectedBookCount > 0 && selectedChapterCount === 0
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
        {hasBooksForQuiz && (
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
              <button
                type="button"
                className="primaryBtn"
                onClick={() => {
                  startSmartQuiz();
                }}
                disabled={smartQuizWordCount < 2}
              >
                {tr("Start Smart Quiz", "Start Smart Quiz")}
              </button>







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
                onClick={() => {
                  setQuizMode("normal");
                  setTimeout(() => setQuizSetupStep(contentStepIndex), 350);
                }}
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
                onClick={() => {
                  setQuizMode("typing");
                  setTimeout(() => setQuizSetupStep(contentStepIndex), 350);
                }}
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
        {hasBooksForQuiz && isAtContentStep && (
        <div className="chapterControlField quizChapterField">
          <div className="quizSetupFieldHeader">
            <span>{tr("Step 2. Content", "ステップ2. コンテンツ")}</span>
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
          {selectedBookCount > 0 && (
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
                        <span aria-hidden="true">{"📄"}</span>
                        {chapter.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedBookCount > 0 && quizSetupChapterGroups.length === 0 && (
            <p className="quizSetupHint">{tr("No chapters found for the selected books.", "選択したブックに章がありません。")}</p>
          )}
          {selectedChapterCount > 0 && quizSetupWords.length >= 2 && (
            <p className="quizSetupWordCount">
              {tr(`${quizSetupWords.length} words ready for this quiz.`, `${quizSetupWords.length}語がクイズの準備完了です。`)}
            </p>
          )}
          {selectedChapterCount > 0 && quizSetupWords.length === 1 && (
            <p className="quizSetupWordCount quizSetupWordCountWarn">
              {tr("Only 1 word selected — need at least 2.", "単語が1つしかありません — 2つ以上必要です。")}
            </p>
          )}
          {selectedChapterCount > 0 && quizSetupWords.length === 0 && (
            <p className="quizSetupWordCount quizSetupWordCountWarn">
              {tr("No matching words found.", "一致する単語が見つかりません。")}
            </p>
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
          <div className="adaptiveReviewTitleRow">
            <h1>{tr("Select Review Book", "復習するブックを選択")}</h1>
            <button
              type="button"
              className="adaptiveReviewInfoBtn"
              aria-label={tr("Learn about Adaptive Review", "適応型復習について見る")}
              title={tr("About Adaptive Review", "適応型復習について")}
              onClick={() => setIsAdaptiveReviewInfoOpen(true)}
            >
              <Info size={18} aria-hidden="true" strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div className="analyticsSection">
          {adaptiveReviewLoading ? (
            <LoadingAnimation
              className="adaptiveReviewLoadingAnimation"
              label={tr("Loading review books...", "復習ブックを読み込み中...")}
            />
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
                const newDueNow = Math.min(
                  dueNow,
                  Math.max(0, Math.floor(Number(summary.newDueNow) || 0))
                );
                const reviewDueNow = Math.min(
                  dueNow,
                  Math.max(0, Math.floor(Number(summary.reviewDueNow) || 0))
                );

                const startReview = () => {
                      if (dueNow <= 0) {
                        openNoticeModal(
                          tr("This book has no words due right now.", "このブックには現在復習期限の単語がありません。"),
                          tr("No Words Due", "復習なし")
                        );
                        return;
                      }
                      openAdaptiveReviewSession(summary.bookId, { backScreen: "adaptiveReviewSelect" });
                    };

                return (
                  <div
                    key={summary.bookId}
                    className={`analyticsCard adaptiveReviewBookCard ${dueNow <= 0 ? "isEmpty" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={startReview}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      startReview();
                    }}
                  >
                    <button
                      type="button"
                      className="adaptiveReviewBookSettingsBtn"
                      aria-label={tr(`Open review settings for ${summary.bookName}`, `${summary.bookName}の復習設定を開く`)}
                      title={tr("Review settings", "復習設定")}
                      onClick={(event) => {
                        event.stopPropagation();
                        openAdaptiveReviewSettings(summary.bookId);
                      }}
                    >
                      <Settings size={16} aria-hidden="true" strokeWidth={2} />
                    </button>
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
                      <span>
                        <strong>{newDueNow}</strong>
                        {tr("new", "新出")}
                      </span>
                      <span>
                        <strong>{reviewDueNow}</strong>
                        {tr("reviews", "復習")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        {renderModal()}
      </div>
    );
  }

  if (screen === "adaptiveReviewSettings") {
    const selectedAdaptiveReviewBook = books.find(
      (book) => String(book.id) === String(selectedAdaptiveReviewBookId)
    );
    const displaySettings = sanitizeAdaptiveReviewDisplaySettings(
      selectedAdaptiveReviewBook?.adaptiveReviewDisplaySettings
    );
    const selectedBookReviewDailyLimit = getBookAdaptiveReviewDailyLimit(selectedAdaptiveReviewBook);
    const selectedBookShuffleDue = getBookAdaptiveReviewShuffleDue(selectedAdaptiveReviewBook);
    const displaySettingOptions = [
      {
        key: "word",
        label: tr("Word", "単語"),
        description: tr("The saved word with Japanese reading when available.", "保存した単語と利用可能な読みを表示します。"),
      },
      {
        key: "meaning",
        label: tr("Meaning", "意味"),
        description: tr("The selected definition or translation.", "選択中の定義または翻訳を表示します。"),
      },
      {
        key: "kanji",
        label: tr("Kanji / word only", "漢字 / 単語のみ"),
        description: tr("The raw saved word without furigana.", "ふりがななしで保存単語を表示します。"),
      },
      {
        key: "furigana",
        label: tr("Furigana / reading", "ふりがな / 読み"),
        description: tr("The reading, kana, or romaji when available.", "利用可能な読み、かな、ローマ字を表示します。"),
      },
      {
        key: "pronunciation",
        label: tr("Pronunciation", "発音"),
        description: tr("Pronunciation, romaji, or reading metadata.", "発音、ローマ字、読み情報を表示します。"),
      },
      {
        key: "exampleSentence",
        label: tr("Example sentence", "例文"),
        description: tr("Shows the AI example sentence with the review word highlighted.", "復習単語を強調したAI例文を表示します。"),
      },
      {
        key: "exampleTranslation",
        label: tr("Example translation", "例文訳"),
        description: tr("Shows the example sentence translation when available.", "利用可能な例文訳を表示します。"),
      },
      {
        key: "chapter",
        label: tr("Chapter", "章"),
        description: tr("Shows the source chapter for the word.", "単語の章を表示します。"),
      },
    ];

    return renderWithSidebar(
      <div className="page">
        <div className="pageHeader">
          <button className="backBtn" aria-label={tr("Go back", "\u623b\u308b")} onClick={() => setScreen("adaptiveReviewSelect")}>&times;</button>
          <h1>
            {selectedAdaptiveReviewBook?.name
              ? `${selectedAdaptiveReviewBook.name} ${tr("Review Settings", "復習設定")}`
              : tr("Review Settings", "復習設定")}
          </h1>
        </div>
        {!selectedAdaptiveReviewBook ? (
          <div className="analyticsCard adaptiveReviewStateCard">
            <h3>{tr("Book not found", "ブックが見つかりません")}</h3>
            <p className="settingsHint">{tr("Go back and choose a review book again.", "戻って復習ブックを選び直してください。")}</p>
          </div>
        ) : (
          <div className="analyticsSection adaptiveReviewSettingsSection">
            <div className="analyticsCard adaptiveReviewSettingsPanel">
              <div className="adaptiveReviewSettingsIntro">
                <div>
                  <h3>{tr("Advanced Settings", "詳細設定")}</h3>
                  <p className="settingsHint">
                    {tr("Control how this book feeds Smart Review sessions.", "このブックのスマート復習セッションの出題量を調整します。")}
                  </p>
                </div>
              </div>
              <div className="settingsRow advancedSettingsRow">
                <span>{tr("New words per day", "1日の新出単語数")}</span>
                <div className="settingsStepper reviewLimitStepper" role="group" aria-label={tr("New words per day", "1日の新出単語数")}>
                  <button
                    type="button"
                    className="secondaryBtn settingsStepperBtn"
                    onClick={() =>
                      updateBookAdaptiveReviewDailyLimit(
                        selectedAdaptiveReviewBook.id,
                        selectedBookReviewDailyLimit - ADAPTIVE_REVIEW_DAILY_LIMIT_STEP
                      )
                    }
                    disabled={selectedBookReviewDailyLimit <= ADAPTIVE_REVIEW_DAILY_LIMIT_MIN}
                    aria-label={tr("Decrease new words per day", "1日の新出単語数を減らす")}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="settingsInput settingsNumberInput"
                    min={ADAPTIVE_REVIEW_DAILY_LIMIT_MIN}
                    max={ADAPTIVE_REVIEW_DAILY_LIMIT_MAX}
                    step={ADAPTIVE_REVIEW_DAILY_LIMIT_STEP}
                    value={selectedBookReviewDailyLimit}
                    onChange={(event) =>
                      updateBookAdaptiveReviewDailyLimit(selectedAdaptiveReviewBook.id, event.target.value)
                    }
                    aria-label={tr("New words per day", "1日の新出単語数")}
                  />
                  <button
                    type="button"
                    className="secondaryBtn settingsStepperBtn"
                    onClick={() =>
                      updateBookAdaptiveReviewDailyLimit(
                        selectedAdaptiveReviewBook.id,
                        selectedBookReviewDailyLimit + ADAPTIVE_REVIEW_DAILY_LIMIT_STEP
                      )
                    }
                    disabled={selectedBookReviewDailyLimit >= ADAPTIVE_REVIEW_DAILY_LIMIT_MAX}
                    aria-label={tr("Increase new words per day", "1日の新出単語数を増やす")}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="settingsRow">
                <span>{tr("Shuffle due words", "期限単語をシャッフル")}</span>
                <button
                  type="button"
                  className={`themeSwitch reviewShuffleSwitch ${selectedBookShuffleDue ? "isDark" : ""}`}
                  onClick={() =>
                    updateBookAdaptiveReviewShuffleDue(selectedAdaptiveReviewBook.id, !selectedBookShuffleDue)
                  }
                  aria-label={tr(
                    selectedBookShuffleDue ? "Turn off shuffle mode" : "Turn on shuffle mode",
                    selectedBookShuffleDue ? "シャッフルをオフにする" : "シャッフルをオンにする"
                  )}
                >
                  <span className="themeSwitchIcon" aria-hidden="true" />
                </button>
              </div>
              <p className="settingsHint">
                {tr(
                  selectedBookShuffleDue
                    ? `Smart Review will add up to ${selectedBookReviewDailyLimit} unseen words per day, plus any previously reviewed words that are due, in random order.`
                    : `Smart Review will add up to ${selectedBookReviewDailyLimit} unseen words per day, plus any previously reviewed words that are due.`,
                  selectedBookShuffleDue
                    ? `スマート復習は1日最大${selectedBookReviewDailyLimit}語の新出単語に、期限が来た復習済み単語を加えてランダム順で読み込みます。`
                    : `スマート復習は1日最大${selectedBookReviewDailyLimit}語の新出単語に、期限が来た復習済み単語を加えて読み込みます。`
                )}
              </p>
              <div className="adaptiveReviewSettingsDivider" />
              <div className="adaptiveReviewSettingsIntro">
                <div>
                  <h3>{tr("Card Display", "カード表示")}</h3>
                  <p className="settingsHint">
                    {tr("Choose what appears before and after reveal.", "答えを表示する前後に見える内容を選びます。")}
                  </p>
                </div>
              </div>
              <div className="adaptiveReviewSettingsTable">
                <div className="adaptiveReviewSettingsHeader" aria-hidden="true">
                  <span>{tr("Attribute", "項目")}</span>
                  <span>{tr("Front", "表")}</span>
                  <span>{tr("Back", "裏")}</span>
                </div>
                {displaySettingOptions.map((option) => (
                  <div className="adaptiveReviewSettingRow" key={option.key}>
                    <div className="adaptiveReviewSettingCopy">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </div>
                    {["front", "back"].map((side) => (
                      <label
                        className="adaptiveReviewSettingCheck"
                        key={`${option.key}-${side}`}
                        aria-label={`${option.label} ${side}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(displaySettings[side]?.[option.key])}
                          onChange={(event) =>
                            updateAdaptiveReviewDisplaySetting(
                              selectedAdaptiveReviewBook?.id,
                              side,
                              option.key,
                              event.target.checked
                            )
                          }
                        />
                        <span aria-hidden="true"></span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="modalActions adaptiveReviewSettingsActions">
              <button type="button" className="modalBtn ghost" onClick={() => setScreen("adaptiveReviewSelect")}>
                {tr("Back", "戻る")}
              </button>
              <button
                type="button"
                className="modalBtn primary"
                onClick={() => openAdaptiveReviewSession(selectedAdaptiveReviewBook.id, { backScreen: "adaptiveReviewSettings" })}
              >
                {tr("Start Review", "復習を開始")}
              </button>
            </div>
          </div>
        )}
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
        displaySettings={sanitizeAdaptiveReviewDisplaySettings(
          selectedAdaptiveReviewBook?.adaptiveReviewDisplaySettings
        )}
        loading={adaptiveReviewLoading}
        error={adaptiveReviewError}
        pendingRating={adaptiveReviewPendingRating}
        goBack={() => {
          if ((adaptiveReviewBackScreen || "adaptiveReviewSelect") === "adaptiveReviewSelect") {
            void openAdaptiveReviewSelect();
            return;
          }
          setAdaptiveReviewError("");
          setScreen(adaptiveReviewBackScreen || "adaptiveReviewSelect");
        }}
        onReload={() => {
          const reviewBook = latestBooksRef.current.find((book) => String(book?.id) === String(selectedAdaptiveReviewBookId));
          const reviewSummary = adaptiveReviewBookSummaries.find(
            (summary) => String(summary?.bookId) === String(selectedAdaptiveReviewBookId)
          );
          return loadAdaptiveReviewQueue(getBookAdaptiveReviewDailyLimit(reviewBook), {
            bookId: selectedAdaptiveReviewBookId,
            shuffleDue: getBookAdaptiveReviewShuffleDue(reviewBook),
            minimumDueItemCount: reviewSummary?.dueNow,
          });
        }}
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

  if (screen === "gallery") {
    return renderWithSidebar(
      <VocabGallery
        authToken={authToken}
        books={books}
        locale={appLocale}
        onBack={() => setScreen("dashboard")}
      />
    );
  }

  return null;
}






