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
            onClick={() => setShowDef(!showDef)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setShowDef((prev) => !prev);
              }
            }}
          >
            {showDef ? getSelectedDefinition(current) : current.word}
          </div>
          <div className="flashControls">
            <button
              onClick={() => {
                setIndex((index - 1 + filteredWords.length) % filteredWords.length);
                setShowDef(false);
              }}
            >
              Prev
            </button>
            <button
              onClick={() => {
                setIndex((index + 1) % filteredWords.length);
                setShowDef(false);
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
