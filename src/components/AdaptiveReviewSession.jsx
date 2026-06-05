import { useEffect, useMemo, useRef, useState } from "react";
import { JapaneseWordDisplay } from "./JapaneseWordDisplay";

export function AdaptiveReviewSession({
  items,
  stats,
  loading,
  error,
  title = "Adaptive Review",
  scopeName = "",
  pendingRating,
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
  const dueNowCount = Math.max(0, Math.floor(Number(stats?.dueNow) || 0));
  const displayedDueNowCount = currentItem ? dueNowCount : 0;
  const selectedDefinition = useMemo(
    () => currentItem?.selectedDefinition || "No definition available.",
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
          </div>
        </div>

        {loading ? (
          <div className="analyticsCard adaptiveReviewStateCard">
            <h3>{isSubmittingRating ? "Saving your rating..." : "Loading your adaptive review queue..."}</h3>
            <p className="settingsHint">
              {isSubmittingRating
                ? "Updating the next review date for this word."
                : "Pulling in the words that are due for review."}
            </p>
          </div>
        ) : null}

        {error ? (
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

        {!loading && !error && !currentItem ? (
          <div className="analyticsCard adaptiveReviewStateCard">
            <h3>No words due right now</h3>
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
                  if (isSubmittingRating) return;
                  setShowAnswer((prev) => !prev);
                }}
                onKeyDown={(event) => {
                  if (isSubmittingRating) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setShowAnswer((prev) => !prev);
                  }
                }}
              >
                <div className="adaptiveReviewFlashcardInner">
                  {!showAnswer ? (
                    <>
                      <strong className="adaptiveReviewWord">
                        <JapaneseWordDisplay wordEntry={currentItem} />
                      </strong>
                      {!currentItem.japaneseRomaji ? <p className="adaptiveReviewPronunciation">
                        {currentItem.pronunciation || "Tap to reveal the selected definition."}
                      </p> : null}
                    </>
                  ) : (
                    <>
                      <p className="adaptiveReviewDefinition">{selectedDefinition}</p>
                    </>
                  )}
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
                    disabled={isSubmittingRating}
                  >
                    Reveal answer
                  </button>
                </div>
              ) : (
                <div className="adaptiveReviewRatingsGrid">
                  <button
                    type="button"
                    className={`adaptiveReviewRatingBtn ${pendingRating === "again" ? "isSaving" : ""}`}
                    onClick={() => onRate("again")}
                    disabled={isSubmittingRating}
                  >
                    <strong>Again</strong>
                    <span>Forgot it</span>
                  </button>
                  <button
                    type="button"
                    className={`adaptiveReviewRatingBtn ${pendingRating === "hard" ? "isSaving" : ""}`}
                    onClick={() => onRate("hard")}
                    disabled={isSubmittingRating}
                  >
                    <strong>Hard</strong>
                    <span>Barely knew it</span>
                  </button>
                  <button
                    type="button"
                    className={`adaptiveReviewRatingBtn ${pendingRating === "good" ? "isSaving" : ""}`}
                    onClick={() => onRate("good")}
                    disabled={isSubmittingRating}
                  >
                    <strong>Good</strong>
                    <span>Knew it</span>
                  </button>
                  <button
                    type="button"
                    className={`adaptiveReviewRatingBtn ${pendingRating === "easy" ? "isSaving" : ""}`}
                    onClick={() => onRate("easy")}
                    disabled={isSubmittingRating}
                  >
                    <strong>Easy</strong>
                    <span>Very strong</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
