import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

export const progressRouter = Router();

progressRouter.use(requireAuth);

progressRouter.get("/", async (req, res) => {
  const userId = req.authUser.id;
  const now = new Date().toISOString();

  try {
    const result = await query(
      `
        SELECT total_xp, coins, streak_count, learned_words_json, updated_at
        FROM progress
        WHERE user_id = $1
      `,
      [userId]
    );
    const row = result.rows[0];

    const learnedWordsRaw = row?.learned_words_json;
    const learnedWords = Array.isArray(learnedWordsRaw)
      ? learnedWordsRaw.filter((item) => typeof item === "string")
      : [];

    const progress = {
      userId,
      username: req.authUser.username,
      totalXp: Math.max(0, Math.floor(Number(row?.total_xp) || 0)),
      coins: Math.max(0, Math.floor(Number(row?.coins) || 0)),
      streakCount: Math.max(1, Math.floor(Number(row?.streak_count) || 1)),
      learnedWords,
      updatedAt: row?.updated_at || null,
    };

    if (!row) {
      await query(
        `
          INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
          VALUES ($1, 0, 0, 1, '[]'::jsonb, $2)
          ON CONFLICT(user_id) DO NOTHING
        `,
        [userId, now]
      );
    }

    res.json(progress);
  } catch {
    res.status(500).json({ error: "progress-query-failed" });
  }
});

progressRouter.put("/", async (req, res) => {
  const userId = req.authUser.id;
  const payload = req.body || {};
  const now = new Date().toISOString();

  const totalXp = Math.max(0, Math.floor(Number(payload.totalXp) || 0));
  const coins = Math.max(0, Math.floor(Number(payload.coins) || 0));
  const streakCount = Math.max(1, Math.floor(Number(payload.streakCount) || 1));
  const learnedWords = Array.isArray(payload.learnedWords)
    ? payload.learnedWords
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    : [];

  try {
    await query(
      `
        INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        ON CONFLICT(user_id) DO UPDATE SET
          total_xp = excluded.total_xp,
          coins = excluded.coins,
          streak_count = excluded.streak_count,
          learned_words_json = excluded.learned_words_json,
          updated_at = excluded.updated_at
      `,
      [userId, totalXp, coins, streakCount, JSON.stringify(learnedWords), now]
    );

    res.json({
      userId,
      username: req.authUser.username,
      totalXp,
      coins,
      streakCount,
      learnedWords,
      updatedAt: now,
    });
  } catch {
    res.status(500).json({ error: "progress-update-failed" });
  }
});
