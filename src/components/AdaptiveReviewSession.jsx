import { useEffect, useMemo, useState } from "react";

export function AdaptiveReviewSession({
  items,
  stats,
  loading,
  error,
  pendingRating,
  goBack,
  onReload,
  onRate,
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const currentItem = items[0] || null;
  const isSubmittingRating = Boolean(pendingRating);
  const dueNowCount = Math.max(0, Math.floor(Number(stats?.dueNow) || 0));
  const overdueCount = Math.max(0, Math.floor(Number(stats?.overdue) || 0));
  const selectedDefinition = useMemo(
    () => currentItem?.selectedDefinition || "No definition available.",
    [currentItem]
  );

  useEffect(() => {
    setShowAnswer(false);
  }, [currentItem?.word, currentItem?.bookId, currentItem?.chapterId]);

  return (
    <div className="page">
      <div className="pageHeader">
        <button className="backBtn" aria-label="Go back" onClick={goBack}>&times;</button>
        <h1>Adaptive Review</h1>
      </div>

      <div className="analyticsSection adaptiveReviewSection">
        <div className="analyticsCard adaptiveReviewHeroCard">
          <div className="adaptiveReviewHeroCopy">
            <h3>Review words before you forget them</h3>
            <p className="settingsHint">
              Reveal the answer, rate your recall, and move to the next card.
            </p>
          </div>
          <div className="adaptiveReviewStatsRow" aria-label="Adaptive review stats">
            <div className="adaptiveReviewStatPill">
              <span>Due</span>
              <strong>{dueNowCount}</strong>
            </div>
            <div className="adaptiveReviewStatPill isOverdue">
              <span>Overdue</span>
              <strong>{overdueCount}</strong>
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
              Your adaptive review queue is clear for now. Come back later, or keep building your vocabulary so the
              scheduler has more to work with.
            </p>
            <div className="modalActions">
              <button type="button" className="modalBtn primary" onClick={onReload}>
                Refresh queue
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && currentItem ? (
          <div className="analyticsCard adaptiveReviewCard">
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
                      <strong className="adaptiveReviewWord">{currentItem.word}</strong>
                      <p className="adaptiveReviewPronunciation">
                        {currentItem.pronunciation || "Tap to reveal the selected definition."}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="adaptiveReviewDefinition">{selectedDefinition}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="adaptiveReviewFooter">
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
