import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(thisDir, "../.env") });
dotenv.config();

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
      email TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      auth_token TEXT,
      auth_token_created_at TEXT
    );
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_status TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_current_period_end TEXT;
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

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users(email)
    WHERE email IS NOT NULL;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_unique
    ON users(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      code_expires_at TEXT NOT NULL,
      verified_token_hash TEXT,
      verified_token_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      code_expires_at TEXT NOT NULL,
      reset_token_hash TEXT,
      reset_token_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      user_low_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_high_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL,
      responded_at TEXT,
      CHECK (user_low_id < user_high_id)
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair_unique
    ON friendships(user_low_id, user_high_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_friendships_status
    ON friendships(status);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS retention_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      event_day_key TEXT NOT NULL,
      event_at TEXT NOT NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_events_unique_daily
    ON retention_events(user_id, event_name, event_day_key);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_retention_events_user_day
    ON retention_events(user_id, event_day_key DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      key TEXT PRIMARY KEY,
      window_start_ms BIGINT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at
    ON api_rate_limits(updated_at);
  `);
}
