import { Router } from "express";
import { requireAdminKey } from "../middleware/admin.js";
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
