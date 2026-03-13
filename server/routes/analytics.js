import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

function getCurrentDayKey(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDayKey(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return getCurrentDayKey();
  return raw;
}

function normalizeEventName(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  return raw === "login" || raw === "register" ? raw : "session_start";
}

analyticsRouter.post("/retention/ping", async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  if (!Number.isFinite(userId) || userId <= 0) {
    res.status(400).json({ error: "invalid-user" });
    return;
  }

  const eventName = normalizeEventName(req.body?.eventName);
  const dayKey = normalizeDayKey(req.body?.dayKey);
  const now = new Date().toISOString();
  const metadata =
    req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
      ? req.body.metadata
      : {};

  try {
    await query(
      `
        INSERT INTO retention_events (user_id, event_name, event_day_key, event_at, metadata_json)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (user_id, event_name, event_day_key) DO NOTHING
      `,
      [userId, eventName, dayKey, now, JSON.stringify(metadata)]
    );
    res.json({ ok: true, eventName, dayKey, recordedAt: now });
  } catch {
    res.status(500).json({ error: "retention-ping-failed" });
  }
});

analyticsRouter.get("/retention/summary", async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  const requestedDays = Math.floor(Number(req.query?.days) || 30);
  const days = Math.max(7, Math.min(120, requestedDays));

  try {
    const result = await query(
      `
        SELECT event_day_key
        FROM retention_events
        WHERE user_id = $1
          AND event_name = 'session_start'
          AND event_day_key >= to_char((current_date - ($2::int - 1)), 'YYYY-MM-DD')
        ORDER BY event_day_key ASC
      `,
      [userId, days]
    );

    const dayKeys = Array.from(new Set((result.rows || []).map((row) => String(row.event_day_key || ""))));
    const activeDays = dayKeys.length;
    const lastActiveDayKey = activeDays > 0 ? dayKeys[dayKeys.length - 1] : null;

    res.json({
      userId,
      windowDays: days,
      activeDays,
      activeRatePercent: Math.round((activeDays / days) * 100),
      lastActiveDayKey,
      dayKeys,
    });
  } catch {
    res.status(500).json({ error: "retention-summary-failed" });
  }
});
