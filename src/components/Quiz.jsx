import { useEffect, useRef, useState } from "react";

export function Quiz({
  words: inputWords = [],
  title = "Quiz",
  goBack,
  mode = "normal",
  isMistakeReview = false,
  onAwardXp,
  onAwardCoins,
  onQuestionCompleted,
  onRecordMistake,
  onResolveMistake,
  onQuizComplete,
  buildBlankQuizQuestions,
  buildQuizQuestions,
  isEquivalentTypingAnswer,
  XP_GAIN_PER_QUIZ_CORRECT,
  DEFAULT_CHAPTER_ID,
  QUIZ_SUCCESS_PROMPTS,
  QUIZ_MISS_PROMPTS,
  getQuizCoinReward,
}) {
  const justAnsweredAtRef = useRef(0);
  const lastAdvanceAtRef = useRef(0);
  const words = inputWords || [];
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [questions, setQuestions] = useState(() =>
    mode === "blank" ? buildBlankQuizQuestions(words) : buildQuizQuestions(words)
  );
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typedSubmitted, setTypedSubmitted] = useState(false);
  const [isTypingHintVisible, setIsTypingHintVisible] = useState(false);
  const [mistakeReviewItems, setMistakeReviewItems] = useState([]);
  const [score, setScore] = useState(0);
  const [motivationPrompt, setMotivationPrompt] = useState("");
  const [isMotivationPositive, setIsMotivationPositive] = useState(false);
  const [completionBonusAwarded, setCompletionBonusAwarded] = useState(false);
  const [quizCompletionReported, setQuizCompletionReported] = useState(false);
  const isTypingMode = mode === "typing";
  const isBlankMode = mode === "blank";

  useEffect(() => {
    setQuestions(
      mode === "blank" ? buildBlankQuizQuestions(words) : buildQuizQuestions(words)
    );
    setIndex(0);
    setSelectedOption(null);
    setTypedAnswer("");
    setTypedSubmitted(false);
    setIsTypingHintVisible(false);
    setMistakeReviewItems([]);
    setScore(0);
    setMotivationPrompt("");
    setIsMotivationPositive(false);
    setCompletionBonusAwarded(false);
    setQuizCompletionReported(false);
  }, [mode, words, buildBlankQuizQuestions, buildQuizQuestions]);

  const current = questions[index];
  const isFinished = questions.length > 0 && index >= questions.length;
  const canGoToNext = isTypingMode ? typedSubmitted : Boolean(selectedOption);
  const totalQuestions = questions.length;
  const correctAnswers = score;
  const wrongAnswers = Math.max(totalQuestions - correctAnswers, 0);
  const accuracyPercent = totalQuestions
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;
  const resultBadge =
    accuracyPercent === 100
      ? "Perfect Run"
      : accuracyPercent >= 80
        ? "Strong Finish"
        : accuracyPercent >= 60
          ? "Solid Progress"
          : "Keep Going";
  const resultHeadline =
    accuracyPercent >= 80
      ? "Excellent effort. You're learning fast."
      : accuracyPercent >= 60
        ? "Nice work. Your vocabulary is improving."
        : "Good attempt. Every round makes you better.";
  const resultMotivation =
    accuracyPercent >= 80
      ? "Challenge yourself and beat this score on the next run."
      : "Review missed words once, then run the quiz again for a higher score.";

  function restartQuiz() {
    setQuestions(
      mode === "blank" ? buildBlankQuizQuestions(words) : buildQuizQuestions(words)
    );
    setIndex(0);
    setSelectedOption(null);
    setTypedAnswer("");
    setTypedSubmitted(false);
    setIsTypingHintVisible(false);
    setMistakeReviewItems([]);
    setScore(0);
    setMotivationPrompt("");
    setIsMotivationPositive(false);
    setCompletionBonusAwarded(false);
    setQuizCompletionReported(false);
  }

  function handleAnswer(option) {
    if (!current || selectedOption) return;
    justAnsweredAtRef.current = Date.now();
    setSelectedOption(option);
    onQuestionCompleted?.(current.sourceBookId ?? null);
    const isCorrect = isBlankMode ? option === current.word : option === current.correctDefinition;
    if (isCorrect) {
      setScore((prev) => prev + 1);
      onAwardXp?.(XP_GAIN_PER_QUIZ_CORRECT);
      onResolveMistake?.(current.word, current.sourceBookId);
    } else {
      setMistakeReviewItems((prev) => [
        ...prev,
        {
          word: current.word,
          definition: current.correctDefinition,
          sourceBookId: current.sourceBookId ?? null,
          chapterId: current.chapterId || DEFAULT_CHAPTER_ID,
        },
      ]);
      onRecordMistake?.(current.word, current.sourceBookId);
    }
    const promptPool = isCorrect ? QUIZ_SUCCESS_PROMPTS : QUIZ_MISS_PROMPTS;
    const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];
    setMotivationPrompt(prompt);
    setIsMotivationPositive(isCorrect);
  }

  function handleTypedAnswer(event) {
    event.preventDefault();
    if (!current || typedSubmitted) return;
    justAnsweredAtRef.current = Date.now();
    onQuestionCompleted?.(current.sourceBookId ?? null);

    const isCorrect = isEquivalentTypingAnswer(typedAnswer, current.word);
    setTypedSubmitted(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      onAwardXp?.(XP_GAIN_PER_QUIZ_CORRECT);
      onResolveMistake?.(current.word, current.sourceBookId);
    } else {
      setMistakeReviewItems((prev) => [
        ...prev,
        {
          word: current.word,
          definition: current.correctDefinition,
          sourceBookId: current.sourceBookId ?? null,
          chapterId: current.chapterId || DEFAULT_CHAPTER_ID,
        },
      ]);
      onRecordMistake?.(current.word, current.sourceBookId);
    }

    const promptPool = isCorrect ? QUIZ_SUCCESS_PROMPTS : QUIZ_MISS_PROMPTS;
    const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];
    setMotivationPrompt(prompt);
    setIsMotivationPositive(isCorrect);
  }

  function goToNext() {
    if (!current || !canGoToNext) return;
    const now = Date.now();
    if (now - lastAdvanceAtRef.current < 300) return;
    if (now - justAnsweredAtRef.current < 180) return;
    lastAdvanceAtRef.current = now;
    setIndex((prev) => prev + 1);
    setSelectedOption(null);
    setTypedAnswer("");
    setTypedSubmitted(false);
    setIsTypingHintVisible(false);
    setMotivationPrompt("");
    setIsMotivationPositive(false);
  }

  function handleBackAttempt() {
    const hasActiveQuestionFlow = questions.length > 0 && Boolean(current) && !isFinished;
    if (!hasActiveQuestionFlow) {
      goBack();
      return;
    }
    setIsExitConfirmOpen(true);
  }

  useEffect(() => {
    if (!isFinished || completionBonusAwarded || questions.length === 0) return;

    const accuracy = Math.round((score / questions.length) * 100);
    const completionBonus =
      accuracy === 100 ? 50 : accuracy >= 80 ? 30 : accuracy >= 60 ? 20 : 10;
    const totalCoinReward = getQuizCoinReward(questions.length, score);

    onAwardXp?.(completionBonus);
    onAwardCoins?.(totalCoinReward);
    setCompletionBonusAwarded(true);
  }, [isFinished, completionBonusAwarded, score, questions.length, onAwardXp, onAwardCoins, getQuizCoinReward]);

  useEffect(() => {
    if (!isFinished || quizCompletionReported) return;
    const questionBookIds = Array.from(
      new Set(
        questions
          .map((question) => question?.sourceBookId)
          .filter((bookId) => bookId !== null && bookId !== undefined)
      )
    );
    onQuizComplete?.({
      mode,
      isMistakeReview,
      mistakes: mistakeReviewItems,
      questionBookIds,
    });
    setQuizCompletionReported(true);
  }, [isFinished, quizCompletionReported, onQuizComplete, mode, isMistakeReview, mistakeReviewItems, questions]);

  useEffect(() => {
    if (isFinished || !current || !canGoToNext) return;

    const handleEnterForNext = (event) => {
      if (event.key !== "Enter") return;
      if (event.repeat) return;
      if (Date.now() - justAnsweredAtRef.current < 250) return;
      event.preventDefault();
      goToNext();
    };

    window.addEventListener("keydown", handleEnterForNext);
    return () => window.removeEventListener("keydown", handleEnterForNext);
  }, [isFinished, current, canGoToNext]);

  return (
    <div className="page">
      <div className="pageHeader">
        <button className="backBtn" aria-label="Go back" onClick={handleBackAttempt}>&times;</button>
        <h1>
          {title || "Quiz"}
          {isMistakeReview
            ? " - Mistake Review"
            : mode === "typing"
              ? " - Typing Quiz"
              : mode === "blank"
                ? " - Fill in the Blank Quiz"
                : ""}
        </h1>
      </div>
      {words.length === 0 ? (
        <p>
          {isMistakeReview
            ? "No mistakes to review from the previous quiz yet."
            : "No words match your quiz setup. Go back and choose different filters."}
        </p>
      ) : words.length < 2 ? (
        <p>
          {isMistakeReview
            ? "Need at least 2 wrong words from the previous quiz to start mistake review."
            : "Add at least 2 words in your selected setup to start a quiz."}
        </p>
      ) : questions.length === 0 ? (
        <p>
          {isMistakeReview
            ? "Could not build a mistake review quiz yet."
            : "Could not generate quiz questions yet. Add more words with definitions."}
        </p>
      ) : isFinished ? (
        <div className="quizResultCard">
          <p className="quizResultBadge">{resultBadge}</p>
          <h2>
            {isMistakeReview
              ? "Mistake Review Complete"
              : mode === "typing"
                ? "Typing Quiz Complete"
                : mode === "blank"
                  ? "Fill in the Blank Quiz Complete"
                  : "Quiz Complete"}
          </h2>
          <p className="quizResultHeadline">{resultHeadline}</p>
          <div className="quizResultStats">
            <div className="quizResultStat">
              <span className="quizResultStatLabel">Accuracy</span>
              <strong>{accuracyPercent}%</strong>
            </div>
            <div className="quizResultStat">
              <span className="quizResultStatLabel">Correct</span>
              <strong>{correctAnswers}</strong>
            </div>
            <div className="quizResultStat">
              <span className="quizResultStatLabel">Missed</span>
              <strong>{wrongAnswers}</strong>
            </div>
          </div>
          <div className="quizResultProgressTrack" aria-hidden="true">
            <div className="quizResultProgressFill" style={{ width: `${accuracyPercent}%` }} />
          </div>
          <p className="quizScoreLine">
            Final score: {score} / {questions.length}
          </p>
          <p className="quizResultMotivation">{resultMotivation}</p>
          {mistakeReviewItems.length > 0 && (
            <div className="quizMistakeReviewCard">
              <h3>Review Mistakes</h3>
              <div className="quizMistakeReviewList">
                {mistakeReviewItems.map((item, itemIndex) => (
                  <div className="quizMistakeReviewItem" key={`${item.word}-${itemIndex}`}>
                    <strong>{item.word}</strong>
                    <p className="quizMistakeDefinition">
                      {item.definition || item.correctAnswer || "Not available"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button className="primaryBtn" onClick={restartQuiz}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="quizCard">
          <div className="quizMeta">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>Score: {score}</span>
          </div>

          {isTypingMode ? (
            <>
              <h2 className="quizPrompt">Type the word for this definition:</h2>
              <p className="quizDefinitionPrompt">{current.correctDefinition}</p>
              <form className="quizTypeForm" onSubmit={handleTypedAnswer}>
                <input
                  type="text"
                  className="quizTypeInput"
                  value={typedAnswer}
                  onChange={(event) => setTypedAnswer(event.target.value)}
                  placeholder="Type the word..."
                  autoComplete="off"
                  disabled={typedSubmitted}
                />
                <button
                  type="button"
                  className="quizHintBtn"
                  aria-label="Show typing hint"
                  title="Show hint"
                  onClick={() => setIsTypingHintVisible(true)}
                  disabled={typedSubmitted}
                >
                  {"\uD83D\uDCA1"}
                </button>
                <button
                  type="submit"
                  className="primaryBtn"
                  disabled={typedSubmitted || !typedAnswer.trim()}
                >
                  Check
                </button>
              </form>
              {isTypingHintVisible && (
                <p className="quizHintText">
                  Hint: starts with "{String(current.word || "").charAt(0)}" (
                  {String(current.word || "").length} letters)
                </p>
              )}
              {typedSubmitted && (
                <p className={`quizTypedResult ${isMotivationPositive ? "correct" : "wrong"}`}>
                  {isMotivationPositive
                    ? `Correct: ${current.word}`
                    : `Correct word: ${current.word}`}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="quizPrompt">
                {isBlankMode ? "Fill in the blank:" : `What is the definition of "${current.word}"?`}
              </h2>
              {isBlankMode && <p className="quizDefinitionPrompt">{current.sentenceWithBlank}</p>}

              <div className="quizOptions">
                {current.options.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = isBlankMode ? option === current.word : option === current.correctDefinition;
                  const showCorrect = selectedOption && isCorrect;
                  const showWrong = isSelected && !isCorrect;

                  return (
                    <button
                      type="button"
                      key={option}
                      className={`quizOption ${showCorrect ? "correct" : ""} ${showWrong ? "wrong" : ""}`}
                      onClick={() => handleAnswer(option)}
                      disabled={Boolean(selectedOption)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {motivationPrompt && (
            <p className={`quizFeedback ${isMotivationPositive ? "positive" : "encourage"}`}>
              {motivationPrompt}
            </p>
          )}

          <div className="quizFooter">
            <button
              type="button"
              className="primaryBtn"
              onClick={goToNext}
              disabled={!canGoToNext}
            >
              {index + 1 === questions.length ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      )}
      {isExitConfirmOpen && (
        <div className="modalOverlay" onClick={() => setIsExitConfirmOpen(false)}>
          <div
            className="modalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-exit-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="quiz-exit-confirm-title">Exit Quiz?</h3>
            <p>Your current quiz progress will be lost.</p>
            <div className="modalActions">
              <button
                type="button"
                className="modalBtn ghost"
                onClick={() => setIsExitConfirmOpen(false)}
              >
                Continue Quiz
              </button>
              <button
                type="button"
                className="modalBtn danger"
                onClick={() => {
                  setIsExitConfirmOpen(false);
                  goBack();
                }}
              >
                Exit Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
