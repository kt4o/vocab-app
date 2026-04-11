import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import hintIconOn from "../assets/typing-hint-icon-on.svg";

const QUIZ_COPY = {
  en: {
    perfectRun: "Perfect Run",
    strongFinish: "Strong Finish",
    solidProgress: "Solid Progress",
    keepGoing: "Keep Going",
    excellentEffort: "Excellent effort. You're learning fast.",
    niceWork: "Nice work. Your vocabulary is improving.",
    goodAttempt: "Good attempt. Every round makes you better.",
    challengeYourself: "Challenge yourself and beat this score on the next run.",
    reviewAndRetry: "Review missed words once, then run the quiz again for a higher score.",
    mistakeReview: "Mistake Review",
    typingQuiz: "Typing Quiz",
    noMistakesYet: "No mistakes to review from the previous quiz yet.",
    noWordsForSetup: "No words match your quiz setup. Go back and choose different filters.",
    needTwoMistakes: "Need at least 2 wrong words from the previous quiz to start mistake review.",
    needTwoWords: "Add at least 2 words in your selected setup to start a quiz.",
    couldNotBuildMistakes: "Could not build a mistake review quiz yet.",
    couldNotBuildQuiz: "Could not generate quiz questions yet. Add more words with definitions.",
    mistakeReviewComplete: "Mistake Review Complete",
    typingQuizComplete: "Typing Quiz Complete",
    quizComplete: "Quiz Complete",
    accuracy: "Accuracy",
    correct: "Correct",
    missed: "Missed",
    bestStreak: "Best Streak",
    finalScore: "Final score",
    reviewMistakes: "Review Mistakes",
    notAvailable: "Not available",
    startMistakeReview: "Start Mistake Review",
    tryAgain: "Try Again",
    back: "Back",
    questionOf: "Question",
    score: "Score",
    streak: "streak",
    typeWordPrompt: "Type the word for this definition:",
    typeWordPlaceholder: "Type the word...",
    showTypingHint: "Show typing hint",
    showHint: "Show hint",
    check: "Check",
    hintPrefix: "Hint: starts with",
    lettersSuffix: "letters",
    correctPrefix: "Correct:",
    correctWordPrefix: "Correct word:",
    definitionPromptPrefix: "What is the definition of",
    finish: "Finish",
    next: "Next",
    exitQuizTitle: "Exit Quiz?",
    exitQuizBody: "Your current quiz progress will be lost.",
    continueQuiz: "Continue Quiz",
    exitQuiz: "Exit Quiz",
    onFire: "On Fire",
    hotStreak: "Hot Streak",
    lockedIn: "Locked In",
    warmingUp: "Warming Up",
    buildMomentum: "Build Momentum",
  },
  ja: {
    perfectRun: "パーフェクト",
    strongFinish: "好成績",
    solidProgress: "順調に上達中",
    keepGoing: "この調子で続けよう",
    excellentEffort: "素晴らしいです。とても速く上達しています。",
    niceWork: "いいですね。語彙力が伸びています。",
    goodAttempt: "よくできました。毎回の挑戦が力になります。",
    challengeYourself: "次はこのスコアを超えてみましょう。",
    reviewAndRetry: "間違えた単語を見直して、もう一度挑戦しましょう。",
    mistakeReview: "ミス復習",
    typingQuiz: "タイピングクイズ",
    noMistakesYet: "前回のクイズで復習するミスはまだありません。",
    noWordsForSetup: "条件に合う単語がありません。戻って条件を変更してください。",
    needTwoMistakes: "ミス復習を開始するには、前回クイズの誤答が2件以上必要です。",
    needTwoWords: "クイズを開始するには、2語以上追加してください。",
    couldNotBuildMistakes: "ミス復習クイズを作成できませんでした。",
    couldNotBuildQuiz: "クイズ問題を作成できませんでした。単語と意味を追加してください。",
    mistakeReviewComplete: "ミス復習 完了",
    typingQuizComplete: "タイピングクイズ 完了",
    quizComplete: "クイズ 完了",
    accuracy: "正答率",
    correct: "正解",
    missed: "不正解",
    bestStreak: "最高連続正解",
    finalScore: "最終スコア",
    reviewMistakes: "ミスを復習",
    notAvailable: "表示できません",
    startMistakeReview: "ミス復習を開始",
    tryAgain: "もう一度",
    back: "戻る",
    questionOf: "問題",
    score: "スコア",
    streak: "連続正解",
    typeWordPrompt: "この意味に対応する英単語を入力してください:",
    typeWordPlaceholder: "英単語を入力...",
    showTypingHint: "タイピングのヒントを表示",
    showHint: "ヒントを表示",
    check: "判定",
    hintPrefix: "ヒント: 先頭は",
    lettersSuffix: "文字",
    correctPrefix: "正解:",
    correctWordPrefix: "正解の単語:",
    definitionPromptPrefix: "次の意味に当てはまる単語はどれですか",
    finish: "終了",
    next: "次へ",
    exitQuizTitle: "クイズを終了しますか？",
    exitQuizBody: "現在のクイズ進捗は失われます。",
    continueQuiz: "クイズを続ける",
    exitQuiz: "終了する",
    onFire: "絶好調",
    hotStreak: "好調",
    lockedIn: "集中中",
    warmingUp: "ウォームアップ",
    buildMomentum: "勢いをつけよう",
  },
};

function getMomentumLabel(streak, copy) {
  if (streak >= 6) return copy.onFire;
  if (streak >= 4) return copy.hotStreak;
  if (streak >= 2) return copy.lockedIn;
  if (streak === 1) return copy.warmingUp;
  return copy.buildMomentum;
}

export function Quiz({
  words: inputWords = [],
  title = "Quiz",
  goBack,
  mode = "normal",
  isMistakeReview = false,
  onQuestionCompleted,
  onRecordMistake,
  onResolveMistake,
  onQuizComplete,
  onStartMistakeReview,
  buildQuizQuestions,
  isEquivalentTypingAnswer,
  DEFAULT_CHAPTER_ID,
  QUIZ_SUCCESS_PROMPTS,
  QUIZ_MISS_PROMPTS,
  locale = "en",
}) {
  const justAnsweredAtRef = useRef(0);
  const lastAdvanceAtRef = useRef(0);
  const words = useMemo(() => inputWords || [], [inputWords]);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [questions, setQuestions] = useState(() => buildQuizQuestions(words));
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typedSubmitted, setTypedSubmitted] = useState(false);
  const [isTypingHintVisible, setIsTypingHintVisible] = useState(false);
  const [mistakeReviewItems, setMistakeReviewItems] = useState([]);
  const [score, setScore] = useState(0);
  const [answerStreak, setAnswerStreak] = useState(0);
  const [bestAnswerStreak, setBestAnswerStreak] = useState(0);
  const [motivationPrompt, setMotivationPrompt] = useState("");
  const [isMotivationPositive, setIsMotivationPositive] = useState(false);
  const [quizCompletionReported, setQuizCompletionReported] = useState(false);
  const [isTypingComposing, setIsTypingComposing] = useState(false);
  const isTypingMode = mode === "typing";
  const copy = QUIZ_COPY[locale] || QUIZ_COPY.en;

  useEffect(() => {
    setQuestions(buildQuizQuestions(words));
    setIndex(0);
    setSelectedOption(null);
    setTypedAnswer("");
    setTypedSubmitted(false);
    setIsTypingHintVisible(false);
    setMistakeReviewItems([]);
    setScore(0);
    setAnswerStreak(0);
    setBestAnswerStreak(0);
    setMotivationPrompt("");
    setIsMotivationPositive(false);
    setQuizCompletionReported(false);
  }, [mode, words, buildQuizQuestions]);

  const current = questions[index];
  const isFinished = questions.length > 0 && index >= questions.length;
  const canGoToNext = isTypingMode ? typedSubmitted : Boolean(selectedOption);
  const totalQuestions = questions.length;
  const correctAnswers = score;
  const wrongAnswers = Math.max(totalQuestions - correctAnswers, 0);
  const momentumLabel = getMomentumLabel(answerStreak, copy);
  const accuracyPercent = totalQuestions
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;
  const resultBadge =
    accuracyPercent === 100
      ? copy.perfectRun
      : accuracyPercent >= 80
        ? copy.strongFinish
        : accuracyPercent >= 60
          ? copy.solidProgress
          : copy.keepGoing;
  const resultHeadline =
    accuracyPercent >= 80
      ? copy.excellentEffort
      : accuracyPercent >= 60
        ? copy.niceWork
        : copy.goodAttempt;
  const resultMotivation =
    accuracyPercent >= 80
      ? copy.challengeYourself
      : copy.reviewAndRetry;
  const resultIcon =
    accuracyPercent === 100
      ? "\uD83C\uDFC6"
      : accuracyPercent >= 80
        ? "\u2728"
        : accuracyPercent >= 60
          ? "\uD83D\uDCAA"
          : "\uD83D\uDE80";

  function restartQuiz() {
    setQuestions(buildQuizQuestions(words));
    setIndex(0);
    setSelectedOption(null);
    setTypedAnswer("");
    setTypedSubmitted(false);
    setIsTypingHintVisible(false);
    setMistakeReviewItems([]);
    setScore(0);
    setAnswerStreak(0);
    setBestAnswerStreak(0);
    setMotivationPrompt("");
    setIsMotivationPositive(false);
    setQuizCompletionReported(false);
  }

  function handleAnswer(option) {
    if (!current || selectedOption) return;
    justAnsweredAtRef.current = Date.now();
    setSelectedOption(option);
    const isCorrect = option === current.correctDefinition;
    onQuestionCompleted?.({
      sourceBookId: current.sourceBookId ?? null,
      sourceChapterId: current.chapterId || DEFAULT_CHAPTER_ID,
      word: current.word,
      mode: "normal",
      isCorrect,
      isMistakeReview,
    });
    if (isCorrect) {
      setScore((prev) => prev + 1);
      setAnswerStreak((prev) => {
        const next = prev + 1;
        setBestAnswerStreak((prevBest) => Math.max(prevBest, next));
        return next;
      });
      onResolveMistake?.(current.word, current.sourceBookId, current.chapterId, {
        awardMastery: !isMistakeReview,
      });
    } else {
      setAnswerStreak(0);
      setMistakeReviewItems((prev) => [
        ...prev,
        {
          word: current.word,
          definition: current.correctDefinition,
          sourceBookId: current.sourceBookId ?? null,
          chapterId: current.chapterId || DEFAULT_CHAPTER_ID,
        },
      ]);
      onRecordMistake?.(current.word, current.sourceBookId, current.chapterId);
    }
    const promptPool = isCorrect ? QUIZ_SUCCESS_PROMPTS : QUIZ_MISS_PROMPTS;
    const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];
    setMotivationPrompt(prompt);
    setIsMotivationPositive(isCorrect);
  }

  function handleTypedAnswer(event) {
    event.preventDefault();
    if (!current || typedSubmitted) return;
    if (isTypingComposing) return;
    justAnsweredAtRef.current = Date.now();

    const isCorrect = isEquivalentTypingAnswer(typedAnswer, current.word);
    onQuestionCompleted?.({
      sourceBookId: current.sourceBookId ?? null,
      sourceChapterId: current.chapterId || DEFAULT_CHAPTER_ID,
      word: current.word,
      mode: "typing",
      isCorrect,
      isMistakeReview,
    });
    setTypedSubmitted(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setAnswerStreak((prev) => {
        const next = prev + 1;
        setBestAnswerStreak((prevBest) => Math.max(prevBest, next));
        return next;
      });
      onResolveMistake?.(current.word, current.sourceBookId, current.chapterId, {
        awardMastery: !isMistakeReview,
      });
    } else {
      setAnswerStreak(0);
      setMistakeReviewItems((prev) => [
        ...prev,
        {
          word: current.word,
          definition: current.correctDefinition,
          sourceBookId: current.sourceBookId ?? null,
          chapterId: current.chapterId || DEFAULT_CHAPTER_ID,
        },
      ]);
      onRecordMistake?.(current.word, current.sourceBookId, current.chapterId);
    }

    const promptPool = isCorrect ? QUIZ_SUCCESS_PROMPTS : QUIZ_MISS_PROMPTS;
    const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];
    setMotivationPrompt(prompt);
    setIsMotivationPositive(isCorrect);
  }

  const goToNext = useCallback(() => {
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
  }, [current, canGoToNext]);

  function handleBackAttempt() {
    const hasActiveQuestionFlow = questions.length > 0 && Boolean(current) && !isFinished;
    if (!hasActiveQuestionFlow) {
      goBack();
      return;
    }
    setIsExitConfirmOpen(true);
  }

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
      if (event.isComposing || event.keyCode === 229) return;
      if (event.repeat) return;
      if (Date.now() - justAnsweredAtRef.current < 250) return;
      event.preventDefault();
      goToNext();
    };

    window.addEventListener("keydown", handleEnterForNext);
    return () => window.removeEventListener("keydown", handleEnterForNext);
  }, [isFinished, current, canGoToNext, goToNext]);

  return (
    <div className="page">
      <div className="pageHeader">
        <button className="backBtn" aria-label={copy.back} onClick={handleBackAttempt}>&times;</button>
        <h1>
          {title || "Quiz"}
          {isMistakeReview
            ? ` - ${copy.mistakeReview}`
            : mode === "typing"
              ? ` - ${copy.typingQuiz}`
                : ""}
        </h1>
      </div>
      {words.length === 0 ? (
        <p>
          {isMistakeReview
            ? copy.noMistakesYet
            : copy.noWordsForSetup}
        </p>
      ) : words.length < 2 ? (
        <p>
          {isMistakeReview
            ? copy.needTwoMistakes
            : copy.needTwoWords}
        </p>
      ) : questions.length === 0 ? (
        <p>
          {isMistakeReview
            ? copy.couldNotBuildMistakes
            : copy.couldNotBuildQuiz}
        </p>
      ) : isFinished ? (
        <div className={`quizResultCard ${mistakeReviewItems.length > 0 ? "hasMistakes" : ""}`}>
          <div className="quizResultLayout">
            <div className="quizResultMain">
              <div className="quizResultHero">
                <span className="quizResultIcon" aria-hidden="true">{resultIcon}</span>
                <div>
                  <p className="quizResultBadge">{resultBadge}</p>
                  <h2>
                    {isMistakeReview
                      ? copy.mistakeReviewComplete
                      : mode === "typing"
                        ? copy.typingQuizComplete
                          : copy.quizComplete}
                  </h2>
                  <p className="quizResultHeadline">{resultHeadline}</p>
                </div>
              </div>

              <div className="quizResultStats">
                <div className="quizResultStat">
                  <span className="quizResultStatLabel">{copy.accuracy}</span>
                  <strong>{accuracyPercent}%</strong>
                </div>
                <div className="quizResultStat">
                  <span className="quizResultStatLabel">{copy.correct}</span>
                  <strong>{correctAnswers}</strong>
                </div>
                <div className="quizResultStat">
                  <span className="quizResultStatLabel">{copy.missed}</span>
                  <strong>{wrongAnswers}</strong>
                </div>
                <div className="quizResultStat">
                  <span className="quizResultStatLabel">{copy.bestStreak}</span>
                  <strong>{bestAnswerStreak}</strong>
                </div>
              </div>
              <div className="quizResultProgressTrack" aria-hidden="true">
                <div className="quizResultProgressFill" style={{ width: `${accuracyPercent}%` }} />
              </div>
              <p className="quizScoreLine">
                {copy.finalScore}: {score} / {questions.length}
              </p>
              <p className="quizResultMotivation">{resultMotivation}</p>
            </div>

            {mistakeReviewItems.length > 0 && (
              <div className="quizMistakeReviewCard">
                <h3>{copy.reviewMistakes}</h3>
                <div className="quizMistakeReviewList">
                  {mistakeReviewItems.map((item, itemIndex) => (
                    <div className="quizMistakeReviewItem" key={`${item.word}-${itemIndex}`}>
                      <strong>{item.word}</strong>
                      <p className="quizMistakeDefinition">
                        {item.definition || item.correctAnswer || copy.notAvailable}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="quizResultActions">
            {mistakeReviewItems.length > 0 && !isMistakeReview ? (
              <button
                type="button"
                className="primaryBtn"
                onClick={() => onStartMistakeReview?.()}
              >
                {copy.startMistakeReview}
              </button>
            ) : null}
            <button className="primaryBtn" onClick={restartQuiz}>
              {copy.tryAgain}
            </button>
            <button className="primaryBtn" onClick={goBack}>
              {copy.back}
            </button>
          </div>
        </div>
      ) : (
        <div className="quizCard">
          <div className="quizMeta">
            <span>
              {copy.questionOf} {index + 1} / {questions.length}
            </span>
            <span>{copy.score}: {score}</span>
          </div>
          <div className="quizMomentumRow">
            <div className={`quizStreakBadge ${answerStreak >= 2 ? "isHot" : ""}`}>
              <span>{momentumLabel}</span>
              <strong>{answerStreak} {copy.streak}</strong>
            </div>
          </div>

          {isTypingMode ? (
            <>
              <h2 className="quizPrompt">{copy.typeWordPrompt}</h2>
              <p className="quizDefinitionPrompt">{current.correctDefinition}</p>
              <form className="quizTypeForm" onSubmit={handleTypedAnswer}>
                <input
                  type="text"
                  className="quizTypeInput"
                  value={typedAnswer}
                  onChange={(event) => setTypedAnswer(event.target.value)}
                  placeholder={copy.typeWordPlaceholder}
                  autoComplete="off"
                  disabled={typedSubmitted}
                  onCompositionStart={() => setIsTypingComposing(true)}
                  onCompositionEnd={() => setIsTypingComposing(false)}
                />
                {!isTypingHintVisible && (
                  <button
                    type="button"
                    className="quizHintBtn"
                    aria-label={copy.showTypingHint}
                    title={copy.showHint}
                    onClick={() => setIsTypingHintVisible(true)}
                    disabled={typedSubmitted}
                  >
                    <img
                      src={hintIconOn}
                      alt=""
                      aria-hidden="true"
                      className="quizHintBtnIcon"
                    />
                  </button>
                )}
                <button
                  type="submit"
                  className="primaryBtn"
                  disabled={typedSubmitted || !typedAnswer.trim()}
                >
                  {copy.check}
                </button>
              </form>
              {isTypingHintVisible && (
                <p className="quizHintText">
                  {copy.hintPrefix} "{String(current.word || "").charAt(0)}" (
                  {String(current.word || "").length} {copy.lettersSuffix})
                </p>
              )}
              {typedSubmitted && (
                <p className={`quizTypedResult ${isMotivationPositive ? "correct" : "wrong"}`}>
                  {isMotivationPositive
                    ? `${copy.correctPrefix} ${current.word}`
                    : `${copy.correctWordPrefix} ${current.word}`}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="quizPrompt">{`${copy.definitionPromptPrefix} "${current.word}"?`}</h2>

              <div className="quizOptions">
                {current.options.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === current.correctDefinition;
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
              {index + 1 === questions.length ? copy.finish : copy.next}
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
            <h3 id="quiz-exit-confirm-title">{copy.exitQuizTitle}</h3>
            <p>{copy.exitQuizBody}</p>
            <div className="modalActions">
              <button
                type="button"
                className="modalBtn ghost"
                onClick={() => setIsExitConfirmOpen(false)}
              >
                {copy.continueQuiz}
              </button>
              <button
                type="button"
                className="modalBtn danger"
                onClick={() => {
                  setIsExitConfirmOpen(false);
                  goBack();
                }}
              >
                {copy.exitQuiz}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
