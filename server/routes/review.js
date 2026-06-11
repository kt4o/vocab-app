import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { computeNextReviewState } from "../lib/reviewScheduler.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeWordKey(value) {
  return normalizeText(value).toLowerCase();
}

function parseStoredBoolean(value, fallbackValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
    if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  }
  return fallbackValue;
}

function shuffleArray(items) {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }
  return nextItems;
}

function getSelectedDefinition(wordEntry) {
  const definitions = Array.isArray(wordEntry?.definitions)
    ? wordEntry.definitions.map((item) => normalizeText(item)).filter(Boolean)
    : normalizeText(wordEntry?.definition)
      ? [normalizeText(wordEntry.definition)]
      : [];
  if (!definitions.length) return "";
  const rawIndex = Number(wordEntry?.currentDefinitionIndex ?? 0);
  const safeIndex = Math.min(
    Math.max(Number.isFinite(rawIndex) ? Math.floor(rawIndex) : 0, 0),
    definitions.length - 1
  );
  return definitions[safeIndex];
}

function getBooksFromAppState(appState) {
  const state =
    appState?.data && typeof appState.data === "object" && !Array.isArray(appState.data)
      ? appState.data
      : appState;
  const books = Array.isArray(state?.books) ? state.books : [];
  return books.filter((book) => book && typeof book === "object" && !Array.isArray(book));
}

function buildWordCatalog(appState) {
  const books = getBooksFromAppState(appState);
  const catalog = new Map();

  books.forEach((book) => {
    const bookId = normalizeText(book?.id);
    if (!bookId) return;
    const bookName = normalizeText(book?.name) || "Book";
    const chapterNameById = new Map(
      (Array.isArray(book?.chapters) ? book.chapters : [])
        .filter((chapter) => chapter && typeof chapter === "object")
        .map((chapter) => [normalizeText(chapter?.id), normalizeText(chapter?.name) || "Chapter"])
    );

    (Array.isArray(book?.words) ? book.words : []).forEach((wordEntry) => {
      const word = normalizeText(wordEntry?.word);
      if (!word) return;
      if (wordEntry?.adaptiveReviewEnabled === false) return;
      const chapterId = normalizeText(wordEntry?.chapterId) || "general";
      const definitions = Array.isArray(wordEntry?.definitions)
        ? wordEntry.definitions.map((item) => normalizeText(item)).filter(Boolean)
        : [];
      const selectedDefinition = getSelectedDefinition(wordEntry);
      const catalogKey = `${bookId}:${chapterId}:${normalizeWordKey(word)}`;
      catalog.set(catalogKey, {
        bookId,
        bookName,
        chapterId,
        chapterName: chapterNameById.get(chapterId) || (chapterId === "general" ? "General" : "Chapter"),
        word,
        definitions,
        selectedDefinition,
        pronunciation: normalizeText(wordEntry?.pronunciation || wordEntry?.pronounciation),
        japaneseReading: normalizeText(
          wordEntry?.japaneseReading ||
            wordEntry?.reading ||
            wordEntry?.pronunciation ||
            wordEntry?.pronounciation
        ),
        japaneseRomaji: normalizeText(wordEntry?.japaneseRomaji),
        exampleSentence: normalizeText(wordEntry?.exampleSentence),
        exampleTranslation: normalizeText(wordEntry?.exampleTranslation),
      });
    });
  });

  return catalog;
}

function buildBookSummaryBase(wordCatalog) {
  const summaries = new Map();

  wordCatalog.forEach((item) => {
    if (!summaries.has(item.bookId)) {
      summaries.set(item.bookId, {
        bookId: item.bookId,
        bookName: item.bookName || "Book",
        totalWords: 0,
        dueNow: 0,
      });
    }

    const summary = summaries.get(item.bookId);
    summary.totalWords += 1;
  });

  return summaries;
}

async function loadUserWordCatalog(userId) {
  const result = await query("SELECT state_json FROM app_state WHERE user_id = $1", [userId]);
  const appState = result.rows[0]?.state_json || {};
  return buildWordCatalog(appState);
}

async function ensureReviewStateRows(userId, wordCatalog, nowIso) {
  const items = Array.from(wordCatalog.values());
  if (!items.length) return;

  const bookIds = items.map((item) => item.bookId);
  const chapterIds = items.map((item) => item.chapterId);
  const words = items.map((item) => item.word);

  await query(
    `
      INSERT INTO word_review_state (
        user_id,
        book_id,
        chapter_id,
        word,
        next_review_at,
        created_at,
        updated_at
      )
      SELECT
        $1,
        input.book_id,
        input.chapter_id,
        input.word,
        $5,
        $5,
        $5
      FROM UNNEST($2::text[], $3::text[], $4::text[]) AS input(book_id, chapter_id, word)
      ON CONFLICT(user_id, book_id, chapter_id, word) DO UPDATE SET
        next_review_at = excluded.next_review_at,
        updated_at = excluded.updated_at
      WHERE word_review_state.last_reviewed_at IS NULL
        AND word_review_state.next_review_at > excluded.next_review_at
    `,
    [userId, bookIds, chapterIds, words, nowIso]
  );
}

function toReviewItem(row, catalogItem) {
  return {
    bookId: row.book_id,
    bookName: catalogItem?.bookName || "Book",
    chapterId: row.chapter_id,
    chapterName: catalogItem?.chapterName || "Chapter",
    word: catalogItem?.word || row.word,
    selectedDefinition: catalogItem?.selectedDefinition || "",
    pronunciation: catalogItem?.pronunciation || "",
    japaneseReading: catalogItem?.japaneseReading || "",
    japaneseRomaji: catalogItem?.japaneseRomaji || "",
    exampleSentence: catalogItem?.exampleSentence || "",
    exampleTranslation: catalogItem?.exampleTranslation || "",
    nextReviewAt: row.next_review_at,
    lastReviewedAt: row.last_reviewed_at || null,
    lastRating: row.last_rating || "",
    successStreak: Math.max(0, Math.floor(Number(row.success_streak) || 0)),
    lapseCount: Math.max(0, Math.floor(Number(row.lapse_count) || 0)),
    easeFactor: Number(row.ease_factor || 2.3),
    intervalDays: Math.max(0, Math.floor(Number(row.interval_days) || 0)),
    dueCount: Math.max(0, Math.floor(Number(row.due_count) || 0)),
  };
}

function getDueReviewRows(rows, wordCatalog) {
  const dueRowsByCatalogKey = new Map();

  rows.forEach((row) => {
    const catalogKey = `${row.book_id}:${row.chapter_id}:${normalizeWordKey(row.word)}`;
    if (!wordCatalog.has(catalogKey)) return;
    const existingRow = dueRowsByCatalogKey.get(catalogKey);
    if (!existingRow) {
      dueRowsByCatalogKey.set(catalogKey, row);
      return;
    }

    const existingNextReviewMs = Date.parse(existingRow.next_review_at || "");
    const nextReviewMs = Date.parse(row.next_review_at || "");
    const existingUpdatedMs = Date.parse(existingRow.updated_at || "");
    const updatedMs = Date.parse(row.updated_at || "");
    const shouldReplace =
      (Number.isFinite(nextReviewMs) && (!Number.isFinite(existingNextReviewMs) || nextReviewMs < existingNextReviewMs)) ||
      (nextReviewMs === existingNextReviewMs &&
        Number.isFinite(updatedMs) &&
        (!Number.isFinite(existingUpdatedMs) || updatedMs < existingUpdatedMs));

    if (shouldReplace) {
      dueRowsByCatalogKey.set(catalogKey, row);
    }
  });

  return Array.from(dueRowsByCatalogKey.values());
}

export const reviewRouter = Router();

reviewRouter.use(requireAuth);

reviewRouter.get("/due", async (req, res) => {
  const userId = req.authUser.id;
  const nowIso = new Date().toISOString();
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query?.limit) || 20)));
  const filterBookId = normalizeText(req.query?.bookId);
  const shuffleDue = parseStoredBoolean(req.query?.shuffleDue, false);

  try {
    const wordCatalog = await loadUserWordCatalog(userId);
    await ensureReviewStateRows(userId, wordCatalog, nowIso);

    const dueRowsResult = await query(
      `
        SELECT *
        FROM word_review_state
        WHERE user_id = $1
          AND next_review_at <= $2
          AND ($3 = '' OR book_id = $3)
        ORDER BY next_review_at ASC, lapse_count DESC, success_streak ASC, updated_at ASC
      `,
      [userId, nowIso, filterBookId]
    );

    const dueRows = getDueReviewRows(dueRowsResult.rows, wordCatalog);
    const dueItems = dueRows
      .map((row) => {
        const catalogKey = `${row.book_id}:${row.chapter_id}:${normalizeWordKey(row.word)}`;
        const catalogItem = wordCatalog.get(catalogKey);
        if (!catalogItem) return null;
        return toReviewItem(row, catalogItem);
      })
      .filter(Boolean);
    const items = (shuffleDue ? shuffleArray(dueItems) : dueItems).slice(0, limit);

    res.json({
      items,
      stats: {
        dueNow: dueItems.length,
      },
    });
  } catch {
    res.status(500).json({ error: "review-due-query-failed" });
  }
});

reviewRouter.get("/summary", async (req, res) => {
  const userId = req.authUser.id;
  const nowIso = new Date().toISOString();

  try {
    const wordCatalog = await loadUserWordCatalog(userId);
    await ensureReviewStateRows(userId, wordCatalog, nowIso);

    const summaries = buildBookSummaryBase(wordCatalog);
    const dueRowsResult = await query(
      `
        SELECT book_id, chapter_id, word, next_review_at, updated_at
        FROM word_review_state
        WHERE user_id = $1
          AND next_review_at <= $2
      `,
      [userId, nowIso]
    );

    const dueRows = getDueReviewRows(dueRowsResult.rows, wordCatalog);

    dueRows.forEach((row) => {
      const catalogKey = `${row.book_id}:${row.chapter_id}:${normalizeWordKey(row.word)}`;
      if (!wordCatalog.has(catalogKey)) return;
      const bookId = normalizeText(row.book_id);
      const summary = summaries.get(bookId);
      if (!summary) return;
      summary.dueNow += 1;
    });

    const books = Array.from(summaries.values()).sort((a, b) => {
      if (b.dueNow !== a.dueNow) return b.dueNow - a.dueNow;
      return a.bookName.localeCompare(b.bookName);
    }).map((book) => ({
      ...book,
      dueNow: Math.min(
        Math.max(0, Math.floor(Number(book.dueNow) || 0)),
        Math.max(0, Math.floor(Number(book.totalWords) || 0))
      ),
    }));

    res.json({
      books,
      stats: {
        dueNow: books.reduce((total, book) => total + book.dueNow, 0),
      },
    });
  } catch {
    res.status(500).json({ error: "review-summary-query-failed" });
  }
});

reviewRouter.post("/rate", async (req, res) => {
  const userId = req.authUser.id;
  const bookId = normalizeText(req.body?.bookId);
  const chapterId = normalizeText(req.body?.chapterId) || "general";
  const word = normalizeText(req.body?.word);
  const rating = normalizeText(req.body?.rating).toLowerCase();
  const nowIso = new Date().toISOString();

  if (!bookId || !word) {
    res.status(400).json({ error: "invalid-review-target" });
    return;
  }

  if (!["again", "hard", "good", "easy"].includes(rating)) {
    res.status(400).json({ error: "invalid-review-rating" });
    return;
  }

  try {
    const wordCatalog = await loadUserWordCatalog(userId);
    const catalogKey = `${bookId}:${chapterId}:${normalizeWordKey(word)}`;
    if (!wordCatalog.has(catalogKey)) {
      res.status(404).json({ error: "review-word-not-found" });
      return;
    }

    await query(
      `
        INSERT INTO word_review_state (
          user_id,
          book_id,
          chapter_id,
          word,
          next_review_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(user_id, book_id, chapter_id, word) DO NOTHING
      `,
      [userId, bookId, chapterId, word, nowIso, nowIso, nowIso]
    );

    const existingResult = await query(
      `
        SELECT ease_factor, interval_days, success_streak, lapse_count, due_count
        FROM word_review_state
        WHERE user_id = $1 AND book_id = $2 AND chapter_id = $3 AND LOWER(word) = LOWER($4)
        ORDER BY next_review_at ASC, updated_at ASC
        LIMIT 1
      `,
      [userId, bookId, chapterId, word]
    );
    const previous = existingResult.rows[0] || {};
    const nextState = computeNextReviewState(
      {
        easeFactor: previous.ease_factor,
        intervalDays: previous.interval_days,
        successStreak: previous.success_streak,
        lapseCount: previous.lapse_count,
        dueCount: previous.due_count,
      },
      rating,
      nowIso
    );

    await query(
      `
        UPDATE word_review_state
        SET next_review_at = $5,
            last_reviewed_at = $6,
            last_rating = $7,
            success_streak = $8,
            lapse_count = $9,
            ease_factor = $10,
            interval_days = $11,
            due_count = $12,
            updated_at = $13
        WHERE user_id = $1 AND book_id = $2 AND chapter_id = $3 AND LOWER(word) = LOWER($4)
      `,
      [
        userId,
        bookId,
        chapterId,
        word,
        nextState.nextReviewAt,
        nextState.lastReviewedAt,
        nextState.lastRating,
        nextState.successStreak,
        nextState.lapseCount,
        nextState.easeFactor,
        nextState.intervalDays,
        nextState.dueCount,
        nextState.updatedAt,
      ]
    );

    res.json({
      ok: true,
      ...nextState,
    });
  } catch {
    res.status(500).json({ error: "review-rate-failed" });
  }
});
