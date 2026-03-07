import { Pool } from "pg";

const connectionString = String(process.env.DATABASE_URL || "").trim();

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const useSsl = String(process.env.PGSSLMODE || "").toLowerCase() !== "disable";

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      auth_token TEXT,
      auth_token_created_at TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 0,
      streak_count INTEGER NOT NULL DEFAULT 1,
      learned_words_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TEXT
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_auth_token ON users(auth_token);
  `);
}
