import crypto from "node:crypto";
import { query } from "../server/db/client.js";
import { JAPANESE_STARTER_BOOK } from "../src/data/japaneseStarterBook.js";

const USERNAME = "test_dev";
const EMAIL = "test_dev@vocalibry.internal";
const PASSWORD = "Test_dev_2024!";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.pbkdf2Sync(password, salt, 120_000, 64, "sha512").toString("hex");
  return `${salt}:${digest}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function dayKey(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// --- Build two books from starter data ---
const allWords = JAPANESE_STARTER_BOOK.words.slice(0, 190);
const book1Words = allWords.slice(0, 150).map((w) => ({ ...w }));
const book2Words = allWords.slice(150, 190).map((w) => ({ ...w }));

const BOOK1_ID = "demo-book-n5-essentials";
const BOOK2_ID = "demo-book-daily-expressions";

const appState = {
  data: {
    books: [
      {
        id: BOOK1_ID,
        name: "N5 Essentials",
        languageMode: "ja_en",
        chapters: JAPANESE_STARTER_BOOK.chapters,
        words: book1Words,
        adaptiveReviewDailyLimit: 20,
      },
      {
        id: BOOK2_ID,
        name: "Daily Expressions",
        languageMode: "ja_en",
        chapters: [{ id: "general", name: "General" }],
        words: book2Words,
        adaptiveReviewDailyLimit: 20,
      },
    ],
  },
};

// --- Assign tier buckets to all 190 words ---
// indices 0-34   → Mastered (interval_days 65-200)
// indices 35-99  → Known    (interval_days 16-58)
// indices 100-159 → Forming  (interval_days 4-13)
// indices 160-189 → Spark    (interval_days 1-3)
// trouble words: indices 115,120,125,130,135,140,145,150,155,160,162,164,166,168,170,172,174,176
const TROUBLE_INDICES = new Set([115,120,125,130,135,140,145,150,155,160,162,164,166,168,170,172,174,176]);

function tierParams(idx) {
  if (idx < 35) {
    // Mastered
    const intervalDays = randomInt(65, 200);
    return {
      intervalDays,
      easeFactor: (2.4 + Math.random() * 0.5).toFixed(2),
      successStreak: randomInt(8, 25),
      lapseCount: randomInt(0, 1),
      dueCount: randomInt(12, 30),
    };
  }
  if (idx < 100) {
    // Known
    const intervalDays = randomInt(16, 58);
    return {
      intervalDays,
      easeFactor: (2.1 + Math.random() * 0.4).toFixed(2),
      successStreak: randomInt(3, 10),
      lapseCount: randomInt(0, 2),
      dueCount: randomInt(6, 15),
    };
  }
  if (idx < 160) {
    // Forming
    const isTrouble = TROUBLE_INDICES.has(idx);
    const intervalDays = randomInt(4, 13);
    return {
      intervalDays,
      easeFactor: isTrouble ? (1.7 + Math.random() * 0.2).toFixed(2) : (1.9 + Math.random() * 0.3).toFixed(2),
      successStreak: isTrouble ? randomInt(0, 1) : randomInt(1, 4),
      lapseCount: isTrouble ? randomInt(3, 6) : randomInt(0, 2),
      dueCount: randomInt(3, 8),
    };
  }
  // Spark
  const isTrouble = TROUBLE_INDICES.has(idx);
  const intervalDays = randomInt(1, 3);
  return {
    intervalDays,
    easeFactor: isTrouble ? (1.7 + Math.random() * 0.15).toFixed(2) : (2.0 + Math.random() * 0.3).toFixed(2),
    successStreak: isTrouble ? 0 : randomInt(0, 2),
    lapseCount: isTrouble ? randomInt(3, 5) : randomInt(0, 2),
    dueCount: randomInt(1, 4),
  };
}

async function main() {
  console.log(`Seeding demo account "${USERNAME}"…`);

  // Check if already exists
  const existing = await query("SELECT id FROM users WHERE username = $1", [USERNAME]);
  if (existing.rows.length > 0) {
    console.log(`Account "${USERNAME}" already exists (id=${existing.rows[0].id}). Skipping.`);
    process.exit(0);
  }

  const nowIso = new Date().toISOString();
  const passwordHash = hashPassword(PASSWORD);
  const authToken = crypto.randomBytes(32).toString("hex");

  // 1. Create user
  const userResult = await query(
    `INSERT INTO users (
      username, email, password_hash, created_at,
      auth_token, auth_token_created_at,
      marketing_opt_in, marketing_opt_in_updated_at,
      legal_accepted_at, legal_version,
      lifetime_pro, plan, role
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id`,
    [
      USERNAME, EMAIL, passwordHash, nowIso,
      authToken, nowIso,
      false, nowIso,
      nowIso, "1.0",
      true, "pro", "user",
    ]
  );
  const userId = userResult.rows[0].id;
  console.log(`  ✓ user created (id=${userId})`);

  // 2. Progress
  await query(
    `INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, 9420, 847, 142, JSON.stringify([]), nowIso]
  );
  console.log("  ✓ progress inserted");

  // 3. App state
  await query(
    `INSERT INTO app_state (user_id, state_json, updated_at) VALUES ($1, $2, $3)`,
    [userId, JSON.stringify(appState), nowIso]
  );
  console.log("  ✓ app_state inserted");

  // 4. word_review_state
  let reviewIdx = 0;
  for (const [bookId, words] of [[BOOK1_ID, book1Words], [BOOK2_ID, book2Words]]) {
    for (const wordEntry of words) {
      const params = tierParams(reviewIdx);
      const lastReviewedAt = daysAgo(randomInt(0, 2));
      const nextReviewAt = new Date(new Date(lastReviewedAt).getTime() + params.intervalDays * 86_400_000).toISOString();
      await query(
        `INSERT INTO word_review_state (
          user_id, book_id, chapter_id, word,
          next_review_at, last_reviewed_at, last_rating,
          success_streak, lapse_count, ease_factor, interval_days, due_count,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT DO NOTHING`,
        [
          userId, bookId, wordEntry.chapterId || "general", wordEntry.word,
          nextReviewAt, lastReviewedAt, params.lapseCount > 0 ? "again" : "good",
          params.successStreak, params.lapseCount,
          params.easeFactor, params.intervalDays, params.dueCount,
          daysAgo(90), nowIso,
        ]
      );
      reviewIdx++;
    }
  }
  console.log(`  ✓ word_review_state inserted (${reviewIdx} words)`);

  // 5. Retention events — session_start for ~77 of last 90 days
  const skipDays = new Set([3, 8, 14, 19, 23, 31, 37, 42, 51, 57, 63, 68, 74, 80, 87]);
  for (let d = 89; d >= 0; d--) {
    if (skipDays.has(d)) continue;
    const key = dayKey(d);
    const eventAt = daysAgo(d);
    await query(
      `INSERT INTO retention_events (user_id, event_name, event_day_key, event_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, event_name, event_day_key) DO NOTHING`,
      [userId, "session_start", key, eventAt, JSON.stringify({})]
    );
  }
  console.log("  ✓ retention_events inserted");

  console.log(`\n✓ Done! Log in as "${USERNAME}" / "${PASSWORD}"`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
