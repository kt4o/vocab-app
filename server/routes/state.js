import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { createUserSnapshot, listUserSnapshots, restoreUserSnapshot } from "../lib/snapshots.js";

export const stateRouter = Router();

stateRouter.use(requireAuth);

stateRouter.get("/snapshots", async (req, res) => {
  const userId = req.authUser.id;
  const limit = Number(req.query?.limit || 25);

  try {
    const result = await listUserSnapshots({ userId, limit });
    if (!result.ok) {
      res.status(400).json({ error: result.error || "snapshot-list-failed" });
      return;
    }
    res.json({
      userId,
      username: req.authUser.username,
      snapshots: result.snapshots,
    });
  } catch {
    res.status(500).json({ error: "snapshot-list-failed" });
  }
});

stateRouter.post("/snapshots", async (req, res) => {
  const userId = req.authUser.id;
  const note = String(req.body?.note || "").trim().slice(0, 240);

  try {
    const result = await createUserSnapshot({
      userId,
      reason: "manual",
      metadata: note ? { note } : {},
      force: true,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error || "snapshot-create-failed" });
      return;
    }
    res.status(201).json({
      userId,
      username: req.authUser.username,
      snapshotId: result.snapshotId,
      createdAt: result.createdAt,
      reason: result.reason || "manual",
    });
  } catch {
    res.status(500).json({ error: "snapshot-create-failed" });
  }
});

stateRouter.post("/snapshots/:snapshotId/restore", async (req, res) => {
  const userId = req.authUser.id;
  const snapshotId = Number(req.params.snapshotId);

  if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
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
      if (result.error === "invalid-snapshot-id") {
        res.status(400).json({ error: "invalid-snapshot-id" });
        return;
      }
      res.status(500).json({ error: "snapshot-restore-failed" });
      return;
    }

    res.json({
      userId,
      username: req.authUser.username,
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

stateRouter.get("/", async (req, res) => {
  const userId = req.authUser.id;

  try {
    const result = await query("SELECT state_json, updated_at FROM app_state WHERE user_id = $1", [
      userId,
    ]);
    const row = result.rows[0];

    const appState =
      row?.state_json && typeof row.state_json === "object" && !Array.isArray(row.state_json)
        ? row.state_json
        : null;

    res.json({
      userId,
      username: req.authUser.username,
      appState,
      updatedAt: row?.updated_at || null,
    });
  } catch {
    res.status(500).json({ error: "state-query-failed" });
  }
});

stateRouter.put("/", async (req, res) => {
  const userId = req.authUser.id;
  const appState = req.body?.appState;
  const now = new Date().toISOString();

  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    res.status(400).json({ error: "invalid-app-state" });
    return;
  }

  try {
    await query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(user_id) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `,
      [userId, JSON.stringify(appState), now]
    );
    try {
      await createUserSnapshot({
        userId,
        reason: "auto-state-update",
      });
    } catch {
      // Snapshot failures should not block state persistence.
    }

    res.json({
      userId,
      username: req.authUser.username,
      updatedAt: now,
    });
  } catch {
    res.status(500).json({ error: "state-update-failed" });
  }
});
