import { useEffect, useState } from "react";

export function Flashcards({
  currentBook,
  goBack,
  getBookChapterList,
  normalizeWordDifficulty,
  WORD_DIFFICULTY_OPTIONS,
  InAppDropdownComponent,
  getSelectedDefinition,
}) {
  const Dropdown = InAppDropdownComponent;
  const [index, setIndex] = useState(0);
  const [showDef, setShowDef] = useState(false);
  const [showWordList, setShowWordList] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
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

  function goToPreviousCard() {
    if (!hasCards) return;
    setIndex((prev) => (prev - 1 + filteredWords.length) % filteredWords.length);
    setShowDef(false);
  }

  function goToNextCard() {
    if (!hasCards) return;
    setIndex((prev) => (prev + 1) % filteredWords.length);
    setShowDef(false);
  }

  function flipCurrentCard() {
    if (!hasCards) return;
    setShowDef((prev) => !prev);
  }

  useEffect(() => {
    setIndex(0);
    setShowDef(false);
    setShowWordList(false);
    setSelectedChapterId("all");
    setSelectedDifficulty("all");
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
  }, [hasCards, filteredWords.length]);

  return (
    <div className="page">
      <div className="pageHeader">
        <button className="backBtn" aria-label="Go back" onClick={goBack}>&times;</button>
        <h1>{currentBook?.name}</h1>
      </div>
      {words.length === 0 ? (
        <p>No words yet.</p>
      ) : filteredWords.length === 0 ? (
        <p>No words in this chapter yet.</p>
      ) : (
        <>
          <div className="flashListRow">
            <div className="chapterControlField flashChapterField">
              <span>Chapter</span>
              <Dropdown
                value={selectedChapterId}
                options={[
                  { value: "all", label: "All Chapters" },
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
              <span>Level</span>
              <Dropdown
                value={selectedDifficulty}
                options={[
                  { value: "all", label: "All Levels" },
                  { value: "unassigned", label: "Unassigned" },
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
            <button
              type="button"
              className="flashListToggleBtn"
              onClick={() => setShowWordList((prev) => !prev)}
              aria-expanded={showWordList}
              aria-controls="flash-word-list"
            >
              {showWordList ? "Hide Word List" : "Show Word List"}
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
            {showDef ? getSelectedDefinition(current) : current.word}
          </div>
          <div className="flashControls">
            <button onClick={goToPreviousCard}>
              Prev
            </button>
            <button onClick={goToNextCard}>
              Next
            </button>
          </div>
          <p className="flashKeybindHint" aria-label="Flashcard keyboard shortcuts">
            Keys: Left/Right to navigate, Space or Enter to flip, L to toggle word list.
          </p>
        </>
      )}
    </div>
  );
}
