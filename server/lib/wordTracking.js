const DEFAULT_CHAPTER_ID = "general";
const VALID_CEFR_LEVELS = new Set(["a1", "a2", "b1", "b2", "c1", "c2"]);

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDifficulty(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return VALID_CEFR_LEVELS.has(normalized) ? normalized : "";
}

function normalizeDefinitions(wordEntry) {
  if (Array.isArray(wordEntry?.definitions)) {
    return wordEntry.definitions
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  const fallback = String(wordEntry?.definition || "").trim();
  return fallback ? [fallback] : [];
}

function getStatePayload(rawState) {
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) return {};
  if (rawState?.data && typeof rawState.data === "object" && !Array.isArray(rawState.data)) {
    return rawState.data;
  }
  return rawState;
}

function getBooksFromState(rawState) {
  const state = getStatePayload(rawState);
  const books = Array.isArray(state?.books) ? state.books : [];
  return books.filter((book) => book && typeof book === "object" && !Array.isArray(book));
}

function buildWordMembershipMap(rawState) {
  const map = new Map();
  const books = getBooksFromState(rawState);

  books.forEach((book) => {
    const bookId = String(book?.id ?? "").trim();
    const bookName = String(book?.name || "").trim().slice(0, 160);
    const words = Array.isArray(book?.words) ? book.words : [];

    words.forEach((wordEntry) => {
      const word = String(wordEntry?.word || "").trim();
      const wordNormalized = normalizeWord(word);
      if (!wordNormalized) return;

      const chapterId = String(wordEntry?.chapterId || DEFAULT_CHAPTER_ID).trim().slice(0, 120);
      const key = `${bookId}::${chapterId || DEFAULT_CHAPTER_ID}::${wordNormalized}`;
      if (map.has(key)) return;

      const definitions = normalizeDefinitions(wordEntry);
      map.set(key, {
        word: word.slice(0, 120),
        wordNormalized,
        cefrLevel: normalizeDifficulty(wordEntry?.difficulty),
        chapterId: chapterId || DEFAULT_CHAPTER_ID,
        bookId: bookId.slice(0, 120),
        bookName: bookName || "Book",
        definitionCount: definitions.length,
      });
    });
  });

  return map;
}

export function getAddedWordsFromStateDiff(previousState, nextState) {
  const previousMap = buildWordMembershipMap(previousState);
  const nextMap = buildWordMembershipMap(nextState);

  return Array.from(nextMap.entries())
    .filter(([key]) => !previousMap.has(key))
    .map(([, value]) => value);
}
