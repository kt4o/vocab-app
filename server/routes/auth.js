import crypto from "node:crypto";
import { Router } from "express";
import { pool, query } from "../db/client.js";

export const authRouter = Router();

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120_000, 64, "sha512").toString("hex");
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = hashPassword(password, salt);
  return `${salt}:${digest}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, expected] = String(passwordHash || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function issueToken() {
  return crypto.randomBytes(32).toString("hex");
}

authRouter.post("/register", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  if (!isValidUsername(username)) {
    res.status(400).json({ error: "invalid-username" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "weak-password" });
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = createPasswordHash(password);
  const token = issueToken();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rows[0]) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "username-taken" });
      return;
    }

    const userInsert = await client.query(
      `
        INSERT INTO users (username, password_hash, created_at, auth_token, auth_token_created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [username, passwordHash, now, token, now]
    );
    const userId = Number(userInsert.rows[0].id);

    await client.query(
      `
        INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
        VALUES ($1, 0, 0, 1, '[]'::jsonb, $2)
      `,
      [userId, now]
    );
    await client.query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, '{}'::jsonb, $2)
      `,
      [userId, now]
    );

    await client.query("COMMIT");
    res.status(201).json({ userId, username, token });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      res.status(409).json({ error: "username-taken" });
      return;
    }
    res.status(500).json({ error: "register-failed" });
  } finally {
    client.release();
  }
});

authRouter.post("/login", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  try {
    const userResult = await query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username]
    );
    const user = userResult.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "invalid-credentials" });
      return;
    }

    const token = issueToken();
    const now = new Date().toISOString();

    await query("UPDATE users SET auth_token = $1, auth_token_created_at = $2 WHERE id = $3", [
      token,
      now,
      user.id,
    ]);
    await query(
      `
        INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
        VALUES ($1, 0, 0, 1, '[]'::jsonb, $2)
        ON CONFLICT(user_id) DO NOTHING
      `,
      [user.id, now]
    );
    await query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, '{}'::jsonb, $2)
        ON CONFLICT(user_id) DO NOTHING
      `,
      [user.id, now]
    );

    res.json({ userId: Number(user.id), username: user.username, token });
  } catch {
    res.status(500).json({ error: "login-failed" });
  }
});
