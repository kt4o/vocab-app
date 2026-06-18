import { useEffect, useMemo, useRef, useState } from "react";
import { AudioButton } from "./AudioButton";
import { JapaneseWordDisplay } from "./JapaneseWordDisplay";

const ADAPTIVE_REVIEW_RATINGS = [
  { value: "again", label: "Again", hint: "Forgot it" },
  { value: "hard", label: "Hard", hint: "Barely knew it" },
  { value: "good", label: "Good", hint: "Knew it" },
  { value: "easy", label: "Easy", hint: "Very strong" },
];
const DEFAULT_DISPLAY_SETTINGS = {
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
const DISPLAY_SETTING_KEYS = Object.keys(DEFAULT_DISPLAY_SETTINGS.front);

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function roundToInt(value, fallback = 1) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function getProjectedReviewIntervalDays(item, rating) {
  const normalizedRating = String(rating || "").trim().toLowerCase();
  const previousEaseFactor = clampNumber(item?.easeFactor, 1.7, 3.0);
  const previousIntervalDays = roundToInt(item?.intervalDays, 1);
  const previousSuccessStreak = Math.max(0, Math.floor(Number(item?.successStreak) || 0));

  if (normalizedRating === "again") return 1;
  if (normalizedRating === "hard") return Math.max(1, roundToInt((previousIntervalDays || 1) * 1.2, 1));

  const nextSuccessStreak = previousSuccessStreak + 1;
  if (normalizedRating === "easy") {
    return nextSuccessStreak <= 1
      ? 5
      : Math.max(2, roundToInt(Math.max(2, previousIntervalDays) * previousEaseFactor * 1.25, 5));
  }

  return nextSuccessStreak <= 1
    ? 3
    : Math.max(2, roundToInt(Math.max(2, previousIntervalDays) * previousEaseFactor, 3));
}

function formatReviewInterval(days) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 1));
  if (safeDays === 1) return "1 day";
  if (safeDays < 14) return `${safeDays} days`;

  const weeks = Math.round(safeDays / 7);
  if (weeks < 8) return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;

  const months = Math.round(safeDays / 30);
  return `${Math.max(2, months)} months`;
}

function sanitizeDisplaySide(rawSide, fallbackSide) {
  const side = rawSide && typeof rawSide === "object" && !Array.isArray(rawSide) ? rawSide : {};
  return DISPLAY_SETTING_KEYS.reduce((nextSide, key) => {
    nextSide[key] = typeof side[key] === "boolean" ? side[key] : Boolean(fallbackSide?.[key]);
    return nextSide;
  }, {});
}

function sanitizeDisplaySettings(rawSettings) {
  const settings =
    rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
      ? rawSettings
      : {};

  return {
    front: sanitizeDisplaySide(settings.front, DEFAULT_DISPLAY_SETTINGS.front),
    back: sanitizeDisplaySide(settings.back, DEFAULT_DISPLAY_SETTINGS.back),
  };
}

function getPronunciationText(item) {
  return String(
    item?.pronunciation ||
      item?.japaneseRomaji ||
      item?.japaneseReading ||
      ""
  ).trim();
}

function getReadingText(item) {
  return String(item?.japaneseReading || item?.japaneseRomaji || item?.pronunciation || "").trim();
}

function highlightReviewWord(text, item) {
  const sentence = String(text || "").trim();
  const candidates = [
    item?.word,
    item?.japaneseReading,
    item?.japaneseRomaji,
    item?.pronunciation,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!sentence || candidates.length === 0) return sentence;

  const lowerSentence = sentence.toLowerCase();
  const target = candidates.find((candidate) => lowerSentence.includes(candidate.toLowerCase()));
  if (!target) return sentence;

  const startIndex = lowerSentence.indexOf(target.toLowerCase());
  if (startIndex < 0) return sentence;

  const endIndex = startIndex + target.length;
  return (
    <>
      {sentence.slice(0, startIndex)}
      <mark className="adaptiveReviewExampleWord">{sentence.slice(startIndex, endIndex)}</mark>
      {sentence.slice(endIndex)}
    </>
  );
}

function getDisplayValueText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(getDisplayValueText).join(" ");
  if (typeof value === "object" && value?.props) {
    return getDisplayValueText(value.props.children);
  }
  return "";
}

function getAdaptiveReviewRowSizeClass(key, rawText, rowCount) {
  const textLength = String(rawText || "").trim().length;
  if (rowCount <= 1) {
    if (["word", "kanji", "furigana", "pronunciation"].includes(key)) return "adaptiveReviewDisplayRowHero";
    if (textLength > 120) return "adaptiveReviewDisplayRowLargeText";
    return "adaptiveReviewDisplayRowHero";
  }
  if (rowCount === 2) {
    if (["word", "kanji"].includes(key)) return "adaptiveReviewDisplayRowPrimary";
    if (textLength > 120) return "adaptiveReviewDisplayRowLargeText";
    return "adaptiveReviewDisplayRowSecondary";
  }
  if (rowCount <= 4) {
    if (["word", "kanji"].includes(key)) return "adaptiveReviewDisplayRowPrimary";
    if (["exampleSentence", "exampleTranslation", "meaning"].includes(key) && textLength > 90) {
      return "adaptiveReviewDisplayRowLargeText";
    }
    return "adaptiveReviewDisplayRowCompact";
  }
  return "adaptiveReviewDisplayRowDense";
}

function buildDisplayRows(item, sideSettings, selectedDefinition) {
  if (!item) return [];

  const rows = [];
  const languageMode = String(item?.languageMode || "en_en").toLowerCase();
  const pushRow = (key, label, value, className = "", rawText = value, audioText = "", audioLanguage = "") => {
    if (!sideSettings?.[key] || !value) return;
    rows.push({
      key,
      label,
      value,
      className,
      rawText: getDisplayValueText(rawText),
      audioText,
      audioLanguage,
    });
  };

  const wordText = String(item.word || "").trim();
  const readingText = getReadingText(item);
  const pronunciationText = getPronunciationText(item);
  const shouldSpeakJapaneseWord = languageMode === "ja_en";
  const shouldSpeakJapaneseMeaning = languageMode === "en_ja";
  const shouldSpeakJapaneseExample = languageMode !== "en_en";

  pushRow(
    "word",
    "Word",
    <JapaneseWordDisplay wordEntry={item} />,
    "adaptiveReviewDisplayValueWord",
    [wordText, readingText, pronunciationText].filter(Boolean).join(" "),
    shouldSpeakJapaneseWord ? wordText : "",
    shouldSpeakJapaneseWord ? "ja-JP" : ""
  );
  pushRow(
    "meaning",
    "Meaning",
    selectedDefinition,
    "adaptiveReviewDisplayValueMeaning",
    selectedDefinition,
    shouldSpeakJapaneseMeaning ? selectedDefinition : "",
    shouldSpeakJapaneseMeaning ? "ja-JP" : ""
  );
  pushRow(
    "kanji",
    "Kanji",
    wordText,
    "adaptiveReviewDisplayValueWord",
    wordText,
    shouldSpeakJapaneseWord ? wordText : "",
    shouldSpeakJapaneseWord ? "ja-JP" : ""
  );
  pushRow(
    "furigana",
    "Reading",
    readingText,
    "adaptiveReviewDisplayValueReading",
    readingText,
    shouldSpeakJapaneseWord ? readingText : "",
    shouldSpeakJapaneseWord ? "ja-JP" : ""
  );
  pushRow("pronunciation", "Pronunciation", pronunciationText, "adaptiveReviewDisplayValueReading");
  pushRow(
    "exampleSentence",
    "Example",
    highlightReviewWord(item.exampleSentence, item),
    "adaptiveReviewDisplayValueExample",
    item.exampleSentence,
    shouldSpeakJapaneseExample ? item.exampleSentence : "",
    shouldSpeakJapaneseExample ? "ja-JP" : ""
  );
  pushRow("exampleTranslation", "Translation", String(item.exampleTranslation || "").trim());
  pushRow("chapter", "Chapter", String(item.chapterName || "").trim());

  if (rows.length > 0) {
    return rows.map((row) => ({
      ...row,
      className: [
        row.className,
        getAdaptiveReviewRowSizeClass(row.key, row.rawText, rows.length),
      ].filter(Boolean).join(" "),
    }));
  }

  return [
    {
      key: "fallback",
      label: "Word",
      value: <JapaneseWordDisplay wordEntry={item} />,
      className: "adaptiveReviewDisplayValueWord adaptiveReviewDisplayRowHero",
    },
  ];
}

export function AdaptiveReviewSession({
  items,
  loading,
  error,
  title = "Adaptive Review",
  scopeName = "",
  pendingRating,
  displaySettings,
  goBack,
  onReload,
  onRate,
  onPracticeQuiz,
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const reviewCardRef = useRef(null);
  const reviewFooterRef = useRef(null);
  const currentItem = items[0] || null;
  const isSubmittingRating = Boolean(pendingRating);
  const visibleQueueCount = Array.isArray(items) ? items.length : 0;
  const visibleReviewDueNowCount = (Array.isArray(items) ? items : []).filter((item) =>
    Boolean(item?.lastReviewedAt)
  ).length;
  const displayedDueNowCount = currentItem ? visibleQueueCount : 0;
  const displayedReviewDueNowCount = currentItem
    ? Math.min(visibleReviewDueNowCount, displayedDueNowCount)
    : 0;
  const displayedNewDueNowCount = currentItem
    ? Math.max(0, displayedDueNowCount - displayedReviewDueNowCount)
    : 0;
  const hasNoDueWords = !currentItem && visibleQueueCount === 0;
  const shouldShowError = Boolean(error) && !hasNoDueWords;
  const selectedDefinition = useMemo(
    () => currentItem?.selectedDefinition || "No definition available.",
    [currentItem]
  );
  const safeDisplaySettings = useMemo(
    () => sanitizeDisplaySettings(displaySettings),
    [displaySettings]
  );
  const visibleRows = useMemo(
    () =>
      buildDisplayRows(
        currentItem,
        showAnswer ? safeDisplaySettings.back : safeDisplaySettings.front,
        selectedDefinition
      ),
    [currentItem, safeDisplaySettings, selectedDefinition, showAnswer]
  );
  const displayRowCountClass = `adaptiveReviewDisplayRowsCount${Math.min(Math.max(visibleRows.length, 1), 6)}`;
  const ratingOptions = useMemo(
    () =>
      ADAPTIVE_REVIEW_RATINGS.map((rating) => ({
        ...rating,
        nextReviewLabel: formatReviewInterval(getProjectedReviewIntervalDays(currentItem, rating.value)),
      })),
    [currentItem]
  );

  useEffect(() => {
    setShowAnswer(false);
    window.requestAnimationFrame(() => {
      reviewCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [currentItem?.word, currentItem?.bookId, currentItem?.chapterId]);

  useEffect(() => {
    if (!showAnswer) return;

    window.requestAnimationFrame(() => {
      reviewFooterRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [showAnswer]);

  return (
    <div className="page">
      <div className="pageHeader">
        <button className="backBtn" aria-label="Go back" onClick={goBack}>&times;</button>
        <h1>{title}</h1>
      </div>

      <div className="analyticsSection adaptiveReviewSection">
        <div className="analyticsCard adaptiveReviewHeroCard">
          <div className="adaptiveReviewHeroCopy">
            <h3>Review words before you forget them</h3>
            <p className="settingsHint">
              {scopeName
                ? `Focused on ${scopeName}. Reveal the answer, rate your recall, and move to the next card.`
                : "Reveal the answer, rate your recall, and move to the next card."}
            </p>
          </div>
          <div className="adaptiveReviewStatsRow" aria-label="Adaptive review stats">
            <div className="adaptiveReviewStatPill">
              <span>Due</span>
              <strong>{displayedDueNowCount}</strong>
            </div>
            <div className="adaptiveReviewStatPill">
              <span>New</span>
              <strong>{displayedNewDueNowCount}</strong>
            </div>
            <div className="adaptiveReviewStatPill">
              <span>Reviews</span>
              <strong>{displayedReviewDueNowCount}</strong>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingAnimation
            className="adaptiveReviewLoadingAnimation"
            label={isSubmittingRating ? "Saving your rating..." : "Loading your adaptive review queue..."}
          />
        ) : null}

        {shouldShowError ? (
          <div className="analyticsCard adaptiveReviewStateCard">
            <h3>Adaptive Review hit a snag</h3>
            <p className="settingsHint">{error}</p>
            <div className="modalActions">
              <button type="button" className="modalBtn primary" onClick={onReload}>
                Reload
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !shouldShowError && !currentItem ? (
          <div className="analyticsCard adaptiveReviewStateCard">
            <h3>No more words due</h3>
            <p className="settingsHint">
              {scopeName
                ? `Your ${scopeName} review queue is clear for now. Come back later, or practice this book another way.`
                : "Your adaptive review queue is clear for now. Come back later, or keep building your vocabulary so the scheduler has more to work with."}
            </p>
            <div className="modalActions">
              {onPracticeQuiz ? (
                <button type="button" className="modalBtn primary" onClick={onPracticeQuiz}>
                  Practice Quiz
                </button>
              ) : null}
              <button type="button" className="modalBtn ghost" onClick={goBack}>
                Back
              </button>
              <button type="button" className="modalBtn primary" onClick={onReload}>
                Refresh queue
              </button>
            </div>
          </div>
        ) : null}

        {!loading && currentItem ? (
          <div className="analyticsCard adaptiveReviewCard" ref={reviewCardRef}>
            <div className="adaptiveReviewCardTop">
              <div>
                <p className="adaptiveReviewMetaLine">
                  {currentItem.bookName} / {currentItem.chapterName}
                </p>
                <p className="adaptiveReviewPromptLabel">{showAnswer ? "Answer" : "Prompt"}</p>
              </div>
              <p className="adaptiveReviewHelpText">{items.length} remaining</p>
            </div>

            <div className="adaptiveReviewFlashcardWrap">
              <div
                className={`adaptiveReviewFlashcard ${showAnswer ? "isRevealed" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setShowAnswer((prev) => !prev);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setShowAnswer((prev) => !prev);
                  }
                }}
              >
                <div className="adaptiveReviewFlashcardInner">
                  <div className={`adaptiveReviewDisplayRows ${displayRowCountClass}`}>
                    {visibleRows.map((row) => (
                      <div className={`adaptiveReviewDisplayRow ${row.className}`} key={row.key}>
                        <span className="adaptiveReviewDisplayLabel">
                          {row.label}
                          <AudioButton
                            text={row.audioText}
                            language={row.audioLanguage}
                            label={`Play ${row.label.toLowerCase()}`}
                            className="adaptiveReviewAudioButton"
                          />
                        </span>
                        <div className="adaptiveReviewDisplayValue">{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="adaptiveReviewFooter" ref={reviewFooterRef}>
              {!showAnswer ? (
                <div className="modalActions adaptiveReviewActions">
                  <button
                    type="button"
                    className="modalBtn primary"
                    onClick={() => setShowAnswer(true)}
                  >
                    Reveal answer
                  </button>
                </div>
              ) : (
                <div className="adaptiveReviewRatingsGrid">
                  {ratingOptions.map((rating) => (
                    <button
                      type="button"
                      className={`adaptiveReviewRatingBtn ${pendingRating === rating.value ? "isSaving" : ""}`}
                      onClick={() => onRate(rating.value)}
                      key={rating.value}
                    >
                      <span className="adaptiveReviewNextTime">{rating.nextReviewLabel}</span>
                      <strong>{rating.label}</strong>
                      <span>{rating.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
