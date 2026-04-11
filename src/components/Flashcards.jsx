import { useCallback, useEffect, useState } from "react";

export function Flashcards({
  currentBook,
  goBack,
  getBookChapterList,
  normalizeWordDifficulty,
  WORD_DIFFICULTY_OPTIONS,
  InAppDropdownComponent,
  getSelectedDefinition,
  locale = "en",
}) {
  const copy = locale === "ja"
    ? {
        noDefinition: "意味がありません",
        noWordsYet: "単語がまだありません。",
        noWordsInChapter: "この章には単語がありません。",
        chapter: "章",
        allChapters: "すべての章",
        level: "レベル",
        allLevels: "すべてのレベル",
        unassigned: "未設定",
        prompt: "表示形式",
        wordToDefinition: "単語 -> 意味",
        definitionToWord: "意味 -> 単語",
        hideWordList: "単語リストを隠す",
        showWordList: "単語リストを表示",
        prev: "前へ",
        next: "次へ",
        keybindHint: "キー: 左右で移動、Space/Enterで反転、Lで単語リスト表示",
        backAria: "戻る",
        keyboardHintAria: "フラッシュカードのキーボードショートカット",
      }
    : {
        noDefinition: "No definition available",
        noWordsYet: "No words yet.",
        noWordsInChapter: "No words in this chapter yet.",
        chapter: "Chapter",
        allChapters: "All Chapters",
        level: "Level",
        allLevels: "All Levels",
        unassigned: "Unassigned",
        prompt: "Prompt",
        wordToDefinition: "Word -> Definition",
        definitionToWord: "Definition -> Word",
        hideWordList: "Hide Word List",
        showWordList: "Show Word List",
        prev: "Prev",
        next: "Next",
        keybindHint: "Keys: Left/Right to navigate, Space or Enter to flip, L to toggle word list.",
        backAria: "Go back",
        keyboardHintAria: "Flashcard keyboard shortcuts",
      };
  const Dropdown = InAppDropdownComponent;
  const [index, setIndex] = useState(0);
  const [showDef, setShowDef] = useState(false);
  const [showWordList, setShowWordList] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [cardPromptMode, setCardPromptMode] = useState("word-to-definition");
  const words = currentBook?.words || [];
  const chapterList = getBookChapterList(currentBook);
  const chapterFilteredWords =
    selectedChapterId === "all"
      ? words
      : words.filter((wordEntry) => wordEntry.chapterId === selectedChapterId);
  const filteredWords =
    selectedDifficulty === "all"
      ? chapterFilteredWords
      : selectedDifficulty === "unassigned"
        ? chapterFilteredWords.filter((wordEntry) => !normalizeWordDifficulty(wordEntry.difficulty))
        : chapterFilteredWords.filter(
            (wordEntry) => normalizeWordDifficulty(wordEntry.difficulty) === selectedDifficulty
          );
  const current = filteredWords[index];
  const hasCards = filteredWords.length > 0;
  const currentDefinition = current ? getSelectedDefinition(current) : "";
  const flashcardFrontText =
    cardPromptMode === "definition-to-word"
      ? currentDefinition || copy.noDefinition
      : current?.word || "";
  const flashcardBackText =
    cardPromptMode === "definition-to-word"
      ? current?.word || ""
      : currentDefinition || copy.noDefinition;

  const goToPreviousCard = useCallback(() => {
    if (!hasCards) return;
    setIndex((prev) => (prev - 1 + filteredWords.length) % filteredWords.length);
    setShowDef(false);
  }, [hasCards, filteredWords.length]);

  const goToNextCard = useCallback(() => {
    if (!hasCards) return;
    setIndex((prev) => (prev + 1) % filteredWords.length);
    setShowDef(false);
  }, [hasCards, filteredWords.length]);

  const flipCurrentCard = useCallback(() => {
    if (!hasCards) return;
    setShowDef((prev) => !prev);
  }, [hasCards]);

  useEffect(() => {
    setIndex(0);
    setShowDef(false);
    setShowWordList(false);
    setSelectedChapterId("all");
    setSelectedDifficulty("all");
    setCardPromptMode("word-to-definition");
  }, [currentBook?.id]);

  useEffect(() => {
    if (index >= filteredWords.length) {
      setIndex(0);
      setShowDef(false);
    }
  }, [index, filteredWords.length]);

  useEffect(() => {
    function isEditableTarget(target) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      );
    }

    function onWindowKeyDown(event) {
      if (!hasCards) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousCard();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextCard();
        return;
      }

      if (event.key === "Enter" || event.key === " " || event.code === "Space") {
        event.preventDefault();
        flipCurrentCard();
        return;
      }

      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        setShowWordList((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [hasCards, flipCurrentCard, goToNextCard, goToPreviousCard]);

  return (
    <div className="page">
      <div className="pageHeader">
        <button className="backBtn" aria-label={copy.backAria} onClick={goBack}>&times;</button>
        <h1>{currentBook?.name}</h1>
      </div>
      {words.length === 0 ? (
        <p>{copy.noWordsYet}</p>
      ) : filteredWords.length === 0 ? (
        <p>{copy.noWordsInChapter}</p>
      ) : (
        <>
          <div className="flashListRow">
            <div className="chapterControlField flashChapterField">
              <span>{copy.chapter}</span>
              <Dropdown
                value={selectedChapterId}
                options={[
                  { value: "all", label: copy.allChapters },
                  ...chapterList.map((chapter) => ({
                    value: chapter.id,
                    label: chapter.name,
                  })),
                ]}
                onChange={(nextChapterId) => {
                  setSelectedChapterId(nextChapterId);
                  setIndex(0);
                  setShowDef(false);
                }}
                className="flashChapterDropdown"
                triggerClassName="isFlashCompact"
                menuClassName="isFlashCompact"
              />
            </div>
            <div className="chapterControlField flashChapterField">
              <span>{copy.level}</span>
              <Dropdown
                value={selectedDifficulty}
                options={[
                  { value: "all", label: copy.allLevels },
                  { value: "unassigned", label: copy.unassigned },
                  ...WORD_DIFFICULTY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
                onChange={(nextDifficulty) => {
                  setSelectedDifficulty(nextDifficulty);
                  setIndex(0);
                  setShowDef(false);
                }}
                className="flashChapterDropdown"
                triggerClassName="isFlashCompact"
                menuClassName="isFlashCompact"
              />
            </div>
            <div className="chapterControlField flashChapterField">
              <span>{copy.prompt}</span>
              <Dropdown
                value={cardPromptMode}
                options={[
                  { value: "word-to-definition", label: copy.wordToDefinition },
                  { value: "definition-to-word", label: copy.definitionToWord },
                ]}
                onChange={(nextMode) => {
                  setCardPromptMode(nextMode);
                  setShowDef(false);
                }}
                className="flashChapterDropdown"
                triggerClassName="isFlashCompact"
                menuClassName="isFlashCompact"
              />
            </div>
            <button
              type="button"
              className="flashListToggleBtn"
              onClick={() => setShowWordList((prev) => !prev)}
              aria-expanded={showWordList}
              aria-controls="flash-word-list"
            >
              {showWordList ? copy.hideWordList : copy.showWordList}
            </button>
            <span className="flashListMeta">
              {index + 1} / {filteredWords.length}
            </span>
          </div>
          {showWordList && (
            <div className="flashWordListPanel" id="flash-word-list">
              {filteredWords.map((entry, wordIndex) => (
                <button
                  key={`${entry.word}-${wordIndex}`}
                  type="button"
                  className={`flashWordListItem ${wordIndex === index ? "isActive" : ""}`}
                  onClick={() => {
                    setIndex(wordIndex);
                    setShowDef(false);
                  }}
                >
                  {entry.word}
                </button>
              ))}
            </div>
          )}
          <div
            className="flashcard"
            role="button"
            tabIndex={0}
            onClick={flipCurrentCard}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flipCurrentCard();
              }
            }}
          >
            {showDef ? flashcardBackText : flashcardFrontText}
          </div>
          <div className="flashControls">
            <button onClick={goToPreviousCard}>
              {copy.prev}
            </button>
            <button onClick={goToNextCard}>
              {copy.next}
            </button>
          </div>
          <p className="flashKeybindHint" aria-label={copy.keyboardHintAria}>
            {copy.keybindHint}
          </p>
        </>
      )}
    </div>
  );
}
