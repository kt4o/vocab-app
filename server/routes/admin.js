import { Router } from "express";
import { requireAdminKey } from "../middleware/admin.js";
import { query } from "../db/client.js";
import {
  createDailySnapshotsForAllUsers,
  createUserSnapshot,
  listUserSnapshots,
  restoreUserSnapshot,
} from "../lib/snapshots.js";

export const adminRouter = Router();

adminRouter.use(requireAdminKey);

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : 0;
}

function normalizeSubscriptionStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function resolvePlanFromSubscriptionStatus(value) {
  const status = normalizeSubscriptionStatus(value);
  if (status === "active" || status === "trialing" || status === "past_due") {
    return "pro";
  }
  return "free";
}

function normalizeSchoolCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 64);
}

function parseNullablePositiveInt(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : null;
}

function isIsoTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp);
}

adminRouter.get("/school-codes", async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          c.id,
          c.school_name,
          c.code,
          c.grants_lifetime_pro,
          c.max_activations,
          c.activation_count,
          c.is_active,
          c.expires_at,
          c.created_at,
          c.updated_at,
          COUNT(r.id)::int AS redemption_count
        FROM school_access_codes c
        LEFT JOIN school_code_redemptions r ON r.code_id = c.id
        GROUP BY c.id
        ORDER BY c.updated_at DESC, c.id DESC
      `
    );
    res.json({
      codes: result.rows.map((row) => ({
        id: Number(row.id),
        schoolName: String(row.school_name || ""),
        code: String(row.code || ""),
        grantsLifetimePro: Boolean(row.grants_lifetime_pro),
        maxActivations: row.max_activations === null ? null : Number(row.max_activations),
        activationCount: Number(row.activation_count || 0),
        redemptionCount: Number(row.redemption_count || 0),
        isActive: Boolean(row.is_active),
        expiresAt: row.expires_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      })),
    });
  } catch {
    res.status(500).json({ error: "school-codes-list-failed" });
  }
});

adminRouter.post("/school-codes", async (req, res) => {
  const schoolName = String(req.body?.schoolName || "").trim().slice(0, 160);
  const code = normalizeSchoolCode(req.body?.code);
  const maxActivations = parseNullablePositiveInt(req.body?.maxActivations);
  const grantsLifetimePro = req.body?.grantsLifetimePro === undefined ? true : Boolean(req.body?.grantsLifetimePro);
  const isActive = req.body?.isActive === undefined ? true : Boolean(req.body?.isActive);
  const expiresAtRaw = String(req.body?.expiresAt || "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  if (!schoolName) {
    res.status(400).json({ error: "invalid-school-name" });
    return;
  }
  if (!code || !/^[A-Z0-9_-]{4,64}$/.test(code)) {
    res.status(400).json({ error: "invalid-school-code" });
    return;
  }
  if (expiresAtRaw && !isIsoTimestamp(expiresAtRaw)) {
    res.status(400).json({ error: "invalid-expiry-date" });
    return;
  }

  const now = new Date().toISOString();
  try {
    const result = await query(
      `
        INSERT INTO school_access_codes (
          school_name,
          code,
          grants_lifetime_pro,
          max_activations,
          activation_count,
          is_active,
          expires_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $7)
        RETURNING
          id,
          school_name,
          code,
          grants_lifetime_pro,
          max_activations,
          activation_count,
          is_active,
          expires_at,
          created_at,
          updated_at
      `,
      [schoolName, code, grantsLifetimePro, maxActivations, isActive, expiresAt, now]
    );
    const row = result.rows[0];
    res.status(201).json({
      id: Number(row.id),
      schoolName: String(row.school_name || ""),
      code: String(row.code || ""),
      grantsLifetimePro: Boolean(row.grants_lifetime_pro),
      maxActivations: row.max_activations === null ? null : Number(row.max_activations),
      activationCount: Number(row.activation_count || 0),
      isActive: Boolean(row.is_active),
      expiresAt: row.expires_at || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    });
  } catch (error) {
    if (String(error?.code || "") === "23505") {
      res.status(409).json({ error: "school-code-already-exists" });
      return;
    }
    res.status(500).json({ error: "school-code-create-failed" });
  }
});

adminRouter.post("/users/:userId/lifetime-pro/grant", async (req, res) => {
  const userId = parsePositiveInt(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "invalid-user-id" });
    return;
  }

  try {
    const result = await query(
      `
        UPDATE users
        SET lifetime_pro = TRUE, plan = 'pro'
        WHERE id = $1
        RETURNING id, username, plan, lifetime_pro, subscription_status
      `,
      [userId]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: "user-not-found" });
      return;
    }

    res.json({
      ok: true,
      userId: Number(user.id),
      username: String(user.username || ""),
      plan: "pro",
      isLifetimePro: Boolean(user.lifetime_pro),
      subscriptionStatus: normalizeSubscriptionStatus(user.subscription_status) || null,
    });
  } catch {
    res.status(500).json({ error: "lifetime-pro-grant-failed" });
  }
});

adminRouter.post("/users/:userId/lifetime-pro/revoke", async (req, res) => {
  const userId = parsePositiveInt(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "invalid-user-id" });
    return;
  }

  try {
    const currentResult = await query(
      "SELECT id, username, subscription_status FROM users WHERE id = $1",
      [userId]
    );
    const currentUser = currentResult.rows[0];
    if (!currentUser) {
      res.status(404).json({ error: "user-not-found" });
      return;
    }

    const nextPlan = resolvePlanFromSubscriptionStatus(currentUser.subscription_status);
    const result = await query(
      `
        UPDATE users
        SET lifetime_pro = FALSE, plan = $2
        WHERE id = $1
        RETURNING id, username, plan, lifetime_pro, subscription_status
      `,
      [userId, nextPlan]
    );
    const user = result.rows[0];
    res.json({
      ok: true,
      userId: Number(user.id),
      username: String(user.username || ""),
      plan: String(user.plan || "free").trim().toLowerCase() === "pro" ? "pro" : "free",
      isLifetimePro: Boolean(user.lifetime_pro),
      subscriptionStatus: normalizeSubscriptionStatus(user.subscription_status) || null,
    });
  } catch {
    res.status(500).json({ error: "lifetime-pro-revoke-failed" });
  }
});

adminRouter.get("/state/users/:userId/snapshots", async (req, res) => {
  const userId = parsePositiveInt(req.params.userId);
  const limit = parsePositiveInt(req.query?.limit) || 25;

  if (!userId) {
    res.status(400).json({ error: "invalid-user-id" });
    return;
  }

  try {
    const result = await listUserSnapshots({ userId, limit });
    if (!result.ok) {
      res.status(400).json({ error: result.error || "snapshot-list-failed" });
      return;
    }
    res.json({
      userId,
      snapshots: result.snapshots,
    });
  } catch {
    res.status(500).json({ error: "snapshot-list-failed" });
  }
});

adminRouter.post("/state/users/:userId/snapshots", async (req, res) => {
  const userId = parsePositiveInt(req.params.userId);
  const note = String(req.body?.note || "").trim().slice(0, 240);

  if (!userId) {
    res.status(400).json({ error: "invalid-user-id" });
    return;
  }

  try {
    const result = await createUserSnapshot({
      userId,
      reason: "admin-manual",
      metadata: note ? { note } : {},
      force: true,
    });
    if (!result.ok) {
      const status = result.error === "user-not-found" ? 404 : 400;
      res.status(status).json({ error: result.error || "snapshot-create-failed" });
      return;
    }
    res.status(201).json({
      userId,
      snapshotId: result.snapshotId,
      createdAt: result.createdAt,
      reason: result.reason || "admin-manual",
    });
  } catch {
    res.status(500).json({ error: "snapshot-create-failed" });
  }
});

adminRouter.post("/state/users/:userId/snapshots/:snapshotId/restore", async (req, res) => {
  const userId = parsePositiveInt(req.params.userId);
  const snapshotId = parsePositiveInt(req.params.snapshotId);

  if (!userId) {
    res.status(400).json({ error: "invalid-user-id" });
    return;
  }
  if (!snapshotId) {
    res.status(400).json({ error: "invalid-snapshot-id" });
    return;
  }

  try {
    const result = await restoreUserSnapshot({ userId, snapshotId });
    if (!result.ok) {
      if (result.error === "snapshot-not-found") {
        res.status(404).json({ error: "snapshot-not-found" });
        return;
      }
      res.status(500).json({ error: "snapshot-restore-failed" });
      return;
    }
    res.json({
      userId,
      restoredAt: result.restoredAt,
      restoredFromSnapshotId: result.restoredFromSnapshotId,
      restoredFromCreatedAt: result.restoredFromCreatedAt,
      beforeSnapshotId: result.beforeSnapshotId,
      afterSnapshotId: result.afterSnapshotId,
    });
  } catch {
    res.status(500).json({ error: "snapshot-restore-failed" });
  }
});

adminRouter.post("/state/snapshots/daily", async (req, res) => {
  const dayKey = String(req.body?.dayKey || "").trim();
  try {
    const result = await createDailySnapshotsForAllUsers({
      dayKey,
      reason: "daily-scheduled",
      metadata: { trigger: "admin-manual" },
    });
    if (!result.ok) {
      res.status(500).json({ error: "daily-snapshot-run-failed" });
      return;
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: "daily-snapshot-run-failed" });
  }
});
