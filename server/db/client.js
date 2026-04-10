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
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS lifetime_pro BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS marketing_opt_in_updated_at TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS legal_accepted_at TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS legal_version TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
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
    CREATE TABLE IF NOT EXISTS user_state_snapshots (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL DEFAULT 'manual',
      snapshot_json JSONB NOT NULL,
      snapshot_hash TEXT NOT NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_auth_token ON users(auth_token);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_state_snapshots_user_created
    ON user_state_snapshots(user_id, id DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_state_snapshots_created_at
    ON user_state_snapshots(created_at);
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

  await query(`
    CREATE TABLE IF NOT EXISTS school_access_codes (
      id SERIAL PRIMARY KEY,
      school_name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      grants_lifetime_pro BOOLEAN NOT NULL DEFAULT TRUE,
      max_activations INTEGER,
      activation_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS school_code_redemptions (
      id SERIAL PRIMARY KEY,
      code_id INTEGER NOT NULL REFERENCES school_access_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redeemed_at TEXT NOT NULL,
      UNIQUE(code_id, user_id),
      UNIQUE(user_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_school_access_codes_active
    ON school_access_codes(is_active, updated_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_school_code_redemptions_user
    ON school_code_redemptions(user_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS school_teacher_assignments (
      id SERIAL PRIMARY KEY,
      code_id INTEGER NOT NULL REFERENCES school_access_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL,
      UNIQUE(code_id, user_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_school_teacher_assignments_user
    ON school_teacher_assignments(user_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_school_teacher_assignments_code
    ON school_teacher_assignments(code_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS word_add_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_id INTEGER REFERENCES school_access_codes(id) ON DELETE SET NULL,
      word TEXT NOT NULL,
      word_normalized TEXT NOT NULL,
      cefr_level TEXT,
      book_id TEXT,
      book_name TEXT,
      chapter_id TEXT,
      definition_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'state_sync',
      added_at TEXT NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_word_add_events_code_added
    ON word_add_events(code_id, added_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_word_add_events_user_added
    ON word_add_events(user_id, added_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_word_add_events_code_cefr
    ON word_add_events(code_id, cefr_level);
  `);
}

export async function closeDb() {
  await pool.end();
}
