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
  const data = appState?.data;
  const books = Array.isArray(data?.books) ? data.books : [];
  return books.filter((book) => book && typeof book === "object");
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
      });
    });
  });

  return catalog;
}

async function loadUserWordCatalog(userId) {
  const result = await query("SELECT state_json FROM app_state WHERE user_id = $1", [userId]);
  const appState = result.rows[0]?.state_json || {};
  return buildWordCatalog(appState);
}

async function ensureReviewStateRows(userId, wordCatalog, nowIso) {
  for (const item of wordCatalog.values()) {
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
      [userId, item.bookId, item.chapterId, item.word, nowIso, nowIso, nowIso]
    );
  }
}

function toReviewItem(row, catalogItem) {
  return {
    bookId: row.book_id,
    bookName: catalogItem?.bookName || "Book",
    chapterId: row.chapter_id,
    chapterName: catalogItem?.chapterName || "Chapter",
    word: row.word,
    selectedDefinition: catalogItem?.selectedDefinition || "",
    pronunciation: catalogItem?.pronunciation || "",
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

export const reviewRouter = Router();

reviewRouter.use(requireAuth);

reviewRouter.use((req, res, next) => {
  if (req.authUser?.plan !== "pro") {
    res.status(403).json({ error: "pro-required" });
    return;
  }
  next();
});

reviewRouter.get("/due", async (req, res) => {
  const userId = req.authUser.id;
  const nowIso = new Date().toISOString();
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query?.limit) || 20)));
  const filterBookId = normalizeText(req.query?.bookId);

  try {
    const wordCatalog = await loadUserWordCatalog(userId);
    await ensureReviewStateRows(userId, wordCatalog, nowIso);

    const dueRows = await query(
      `
        SELECT *
        FROM word_review_state
        WHERE user_id = $1
          AND next_review_at <= $2
          AND ($3 = '' OR book_id = $3)
        ORDER BY next_review_at ASC, lapse_count DESC, success_streak ASC, updated_at ASC
        LIMIT $4
      `,
      [userId, nowIso, filterBookId, limit]
    );

    const dueCountResult = await query(
      `
        SELECT COUNT(*)::int AS count
        FROM word_review_state
        WHERE user_id = $1
          AND next_review_at <= $2
          AND ($3 = '' OR book_id = $3)
      `,
      [userId, nowIso, filterBookId]
    );

    const overdueBeforeIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const overdueCountResult = await query(
      `
        SELECT COUNT(*)::int AS count
        FROM word_review_state
        WHERE user_id = $1
          AND next_review_at <= $2
          AND ($3 = '' OR book_id = $3)
      `,
      [userId, overdueBeforeIso, filterBookId]
    );

    const items = dueRows.rows
      .map((row) => {
        const catalogKey = `${row.book_id}:${row.chapter_id}:${normalizeWordKey(row.word)}`;
        const catalogItem = wordCatalog.get(catalogKey);
        if (!catalogItem) return null;
        return toReviewItem(row, catalogItem);
      })
      .filter(Boolean);

    res.json({
      items,
      stats: {
        dueNow: Math.max(0, Math.floor(Number(dueCountResult.rows[0]?.count) || 0)),
        overdue: Math.max(0, Math.floor(Number(overdueCountResult.rows[0]?.count) || 0)),
      },
    });
  } catch {
    res.status(500).json({ error: "review-due-query-failed" });
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
        WHERE user_id = $1 AND book_id = $2 AND chapter_id = $3 AND word = $4
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
        WHERE user_id = $1 AND book_id = $2 AND chapter_id = $3 AND word = $4
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
