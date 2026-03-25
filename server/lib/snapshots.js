import crypto from "node:crypto";
import { pool, query } from "../db/client.js";

const SNAPSHOT_VERSION = 1;
const AUTO_SNAPSHOT_MIN_INTERVAL_MS = Math.max(
  0,
  Math.floor(Number(process.env.AUTO_SNAPSHOT_MIN_INTERVAL_MS) || 6 * 60 * 60 * 1000)
);
const SNAPSHOT_MAX_PER_USER = Math.max(10, Math.floor(Number(process.env.SNAPSHOT_MAX_PER_USER) || 200));

function toSafeIsoNow() {
  return new Date().toISOString();
}

export function getUtcDayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function toSafeObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

function normalizeReason(value, fallback = "manual") {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 64);
  return normalized || fallback;
}

function normalizeMetadata(value) {
  const metadata = toSafeObject(value, {});
  return JSON.parse(JSON.stringify(metadata));
}

function normalizeSnapshotLimit(value, fallback = 25) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

function computeSnapshotHash(snapshotPayload) {
  return crypto.createHash("sha256").update(JSON.stringify(snapshotPayload)).digest("hex");
}

async function fetchUserSnapshotPayload(userId) {
  const result = await query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.plan,
        p.total_xp,
        p.coins,
        p.streak_count,
        p.learned_words_json,
        p.updated_at AS progress_updated_at,
        a.state_json,
        a.updated_at AS state_updated_at
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      LEFT JOIN app_state a ON a.user_id = u.id
      WHERE u.id = $1
    `,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;

  const learnedWordsRaw = row.learned_words_json;
  const learnedWords = Array.isArray(learnedWordsRaw)
    ? learnedWordsRaw.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const appState = toSafeObject(row.state_json, {});
  const createdAt = toSafeIsoNow();
  const payload = {
    backupVersion: SNAPSHOT_VERSION,
    createdAt,
    user: {
      id: Number(row.id),
      username: String(row.username || "").trim().toLowerCase(),
      email: String(row.email || "").trim().toLowerCase(),
      plan: String(row.plan || "free").trim().toLowerCase() === "pro" ? "pro" : "free",
    },
    progress: {
      totalXp: Math.max(0, Math.floor(Number(row.total_xp) || 0)),
      coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
      streakCount: Math.max(1, Math.floor(Number(row.streak_count) || 1)),
      learnedWords,
      updatedAt: row.progress_updated_at || null,
    },
    appState,
    appStateUpdatedAt: row.state_updated_at || null,
  };
  return payload;
}

async function pruneUserSnapshots(userId) {
  await query(
    `
      DELETE FROM user_state_snapshots
      WHERE user_id = $1
      AND id NOT IN (
        SELECT id
        FROM user_state_snapshots
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT $2
      )
    `,
    [userId, SNAPSHOT_MAX_PER_USER]
  );
}

export async function createUserSnapshot({
  userId,
  reason = "manual",
  metadata = {},
  force = false,
} = {}) {
  const safeUserId = Number(userId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
    return { ok: false, error: "invalid-user-id" };
  }

  const safeReason = normalizeReason(reason);
  const safeMetadata = normalizeMetadata(metadata);
  const payload = await fetchUserSnapshotPayload(safeUserId);
  if (!payload) {
    return { ok: false, error: "user-not-found" };
  }
  const snapshotHash = computeSnapshotHash({
    progress: payload.progress,
    appState: payload.appState,
    appStateUpdatedAt: payload.appStateUpdatedAt,
  });

  const latestResult = await query(
    `
      SELECT id, snapshot_hash, created_at
      FROM user_state_snapshots
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [safeUserId]
  );
  const latest = latestResult.rows[0] || null;

  if (!force && latest) {
    const sameHash = String(latest.snapshot_hash || "") === snapshotHash;
    if (sameHash) {
      return {
        ok: true,
        skipped: true,
        skipReason: "unchanged",
        snapshotId: Number(latest.id),
        createdAt: latest.created_at || null,
      };
    }
    if (safeReason.startsWith("auto-")) {
      const latestCreatedAtMs = new Date(String(latest.created_at || "")).getTime();
      const elapsedMs = Number.isFinite(latestCreatedAtMs) ? Date.now() - latestCreatedAtMs : AUTO_SNAPSHOT_MIN_INTERVAL_MS;
      if (elapsedMs < AUTO_SNAPSHOT_MIN_INTERVAL_MS) {
        return {
          ok: true,
          skipped: true,
          skipReason: "throttled",
          snapshotId: Number(latest.id),
          createdAt: latest.created_at || null,
        };
      }
    }
  }

  const createdAt = toSafeIsoNow();
  const insertResult = await query(
    `
      INSERT INTO user_state_snapshots (
        user_id,
        reason,
        snapshot_json,
        snapshot_hash,
        metadata_json,
        created_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6)
      RETURNING id, created_at
    `,
    [
      safeUserId,
      safeReason,
      JSON.stringify(payload),
      snapshotHash,
      JSON.stringify(safeMetadata),
      createdAt,
    ]
  );

  await pruneUserSnapshots(safeUserId);
  const inserted = insertResult.rows[0];
  return {
    ok: true,
    skipped: false,
    snapshotId: Number(inserted.id),
    createdAt: inserted.created_at || createdAt,
    reason: safeReason,
  };
}

export async function listUserSnapshots({ userId, limit = 25 } = {}) {
  const safeUserId = Number(userId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
    return { ok: false, error: "invalid-user-id" };
  }
  const safeLimit = normalizeSnapshotLimit(limit, 25);
  const result = await query(
    `
      SELECT id, reason, metadata_json, created_at, snapshot_json
      FROM user_state_snapshots
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT $2
    `,
    [safeUserId, safeLimit]
  );

  const snapshots = result.rows.map((row) => {
    const payload = toSafeObject(row.snapshot_json, {});
    const progress = toSafeObject(payload.progress, {});
    const appState = toSafeObject(payload.appState, {});
    const learnedWords = Array.isArray(progress.learnedWords) ? progress.learnedWords : [];
    const books = Array.isArray(appState?.data?.books) ? appState.data.books : [];
    return {
      id: Number(row.id),
      reason: String(row.reason || ""),
      createdAt: row.created_at || null,
      metadata: toSafeObject(row.metadata_json, {}),
      summary: {
        totalXp: Math.max(0, Math.floor(Number(progress.totalXp) || 0)),
        coins: Math.max(0, Math.floor(Number(progress.coins) || 0)),
        streakCount: Math.max(1, Math.floor(Number(progress.streakCount) || 1)),
        learnedWordsCount: learnedWords.length,
        booksCount: books.length,
      },
    };
  });

  return { ok: true, snapshots };
}

export async function restoreUserSnapshot({ userId, snapshotId } = {}) {
  const safeUserId = Number(userId);
  const safeSnapshotId = Number(snapshotId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
    return { ok: false, error: "invalid-user-id" };
  }
  if (!Number.isFinite(safeSnapshotId) || safeSnapshotId <= 0) {
    return { ok: false, error: "invalid-snapshot-id" };
  }

  const snapshotResult = await query(
    `
      SELECT id, snapshot_json, created_at
      FROM user_state_snapshots
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [safeSnapshotId, safeUserId]
  );
  const row = snapshotResult.rows[0];
  if (!row) {
    return { ok: false, error: "snapshot-not-found" };
  }

  const payload = toSafeObject(row.snapshot_json, {});
  const progressRaw = toSafeObject(payload.progress, {});
  const appState = toSafeObject(payload.appState, {});
  const learnedWords = Array.isArray(progressRaw.learnedWords)
    ? progressRaw.learnedWords.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const totalXp = Math.max(0, Math.floor(Number(progressRaw.totalXp) || 0));
  const coins = Math.max(0, Math.floor(Number(progressRaw.coins) || 0));
  const streakCount = Math.max(1, Math.floor(Number(progressRaw.streakCount) || 1));

  const beforeSnapshot = await createUserSnapshot({
    userId: safeUserId,
    reason: "pre-restore",
    metadata: { targetSnapshotId: safeSnapshotId },
    force: true,
  });

  const now = toSafeIsoNow();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
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
      [safeUserId, totalXp, coins, streakCount, JSON.stringify(learnedWords), now]
    );
    await client.query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(user_id) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `,
      [safeUserId, JSON.stringify(appState), now]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    return { ok: false, error: "restore-failed", details: String(error?.message || "") };
  } finally {
    client.release();
  }

  const afterSnapshot = await createUserSnapshot({
    userId: safeUserId,
    reason: "restore-applied",
    metadata: { fromSnapshotId: safeSnapshotId, beforeSnapshotId: beforeSnapshot.snapshotId || null },
    force: true,
  });

  return {
    ok: true,
    restoredAt: now,
    restoredFromSnapshotId: safeSnapshotId,
    restoredFromCreatedAt: row.created_at || null,
    beforeSnapshotId: beforeSnapshot.snapshotId || null,
    afterSnapshotId: afterSnapshot.snapshotId || null,
  };
}

export async function createDailySnapshotsForAllUsers({
  dayKey = getUtcDayKey(),
  reason = "daily-scheduled",
  metadata = {},
} = {}) {
  const safeDayKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || "")) ? String(dayKey) : getUtcDayKey();
  const safeReason = normalizeReason(reason, "daily-scheduled");
  const safeMetadata = normalizeMetadata(metadata);

  const usersResult = await query("SELECT id FROM users ORDER BY id ASC");
  const userIds = usersResult.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!userIds.length) {
    return {
      ok: true,
      dayKey: safeDayKey,
      reason: safeReason,
      totalUsers: 0,
      created: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const existingDailyResult = await query(
    `
      SELECT user_id
      FROM user_state_snapshots
      WHERE reason = $1
      AND metadata_json->>'dayKey' = $2
    `,
    [safeReason, safeDayKey]
  );
  const existingUserIds = new Set(
    existingDailyResult.rows
      .map((row) => Number(row.user_id))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    if (existingUserIds.has(userId)) {
      skipped += 1;
      continue;
    }

    try {
      const result = await createUserSnapshot({
        userId,
        reason: safeReason,
        metadata: {
          ...safeMetadata,
          dayKey: safeDayKey,
        },
        force: true,
      });
      if (!result.ok) {
        failed += 1;
      } else if (result.skipped) {
        skipped += 1;
      } else {
        created += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    ok: true,
    dayKey: safeDayKey,
    reason: safeReason,
    totalUsers: userIds.length,
    created,
    skipped,
    failed,
  };
}
