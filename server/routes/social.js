import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

export const socialRouter = Router();

socialRouter.use(requireAuth);

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePlan(value) {
  return String(value || "").trim().toLowerCase() === "pro" ? "pro" : "free";
}

function getPairIds(userIdA, userIdB) {
  const a = Number(userIdA);
  const b = Number(userIdB);
  return a < b ? { lowId: a, highId: b } : { lowId: b, highId: a };
}

function sumNumber(total, value) {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return total;
  return total + Math.max(0, safe);
}

function getCurrentDayKey(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyStatTotals() {
  return {
    wordsAdded: 0,
    questionsCompleted: 0,
    timeSpentSeconds: 0,
  };
}

function addActivityEntryToTotals(totals, entry) {
  if (!entry || typeof entry !== "object") return;
  totals.wordsAdded = sumNumber(totals.wordsAdded, entry.wordsAdded);
  totals.questionsCompleted = sumNumber(totals.questionsCompleted, entry.questionsCompleted);
  totals.timeSpentSeconds = sumNumber(totals.timeSpentSeconds, entry.timeSpentSeconds);
}

function buildStatsBucket(activityHistory, predicate) {
  const totals = createEmptyStatTotals();
  Object.entries(activityHistory).forEach(([dayKey, entry]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
    if (typeof predicate === "function" && !predicate(dayKey)) return;
    addActivityEntryToTotals(totals, entry);
  });
  return {
    wordsAdded: Math.floor(totals.wordsAdded),
    questionsCompleted: Math.floor(totals.questionsCompleted),
    timeSpentSeconds: Math.floor(totals.timeSpentSeconds),
  };
}

function parseDayKey(dayKey) {
  if (typeof dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const [year, month, day] = dayKey.split("-").map((value) => Number(value));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function hasAnyActivity(entry) {
  if (!entry || typeof entry !== "object") return false;
  const wordsAdded = Math.max(0, Math.floor(Number(entry.wordsAdded) || 0));
  const questionsCompleted = Math.max(0, Math.floor(Number(entry.questionsCompleted) || 0));
  const timeSpentSeconds = Math.max(0, Math.floor(Number(entry.timeSpentSeconds) || 0));
  return wordsAdded > 0 || questionsCompleted > 0 || timeSpentSeconds > 0;
}

function getCurrentStreakCount(activityHistory) {
  const activeDayKeys = new Set(
    Object.entries(activityHistory || {})
      .filter(([dayKey, entry]) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey) && hasAnyActivity(entry))
      .map(([dayKey]) => dayKey)
  );
  if (!activeDayKeys.size) return 0;

  const todayKey = getCurrentDayKey(new Date());
  const todayDate = parseDayKey(todayKey);
  if (!todayDate) return 0;

  let cursor = todayDate;
  if (!activeDayKeys.has(todayKey)) {
    cursor = addDays(todayDate, -1);
    const cursorKey = getCurrentDayKey(cursor);
    if (!activeDayKeys.has(cursorKey)) return 0;
  }

  let streak = 0;
  while (true) {
    const cursorKey = getCurrentDayKey(cursor);
    if (!activeDayKeys.has(cursorKey)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function getSocialStatsFromState(stateJson) {
  const data =
    stateJson && typeof stateJson === "object" && !Array.isArray(stateJson) ? stateJson.data : null;
  const activityHistory =
    data?.activityHistory && typeof data.activityHistory === "object" && !Array.isArray(data.activityHistory)
      ? data.activityHistory
      : {};

  const today = new Date();
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  const startWeek = new Date(end);
  startWeek.setDate(end.getDate() - 6);
  const startWeekKey = getCurrentDayKey(startWeek);
  const endKey = getCurrentDayKey(end);
  const yearPrefix = `${today.getFullYear()}-`;
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-`;

  return {
    weekly: buildStatsBucket(activityHistory, (dayKey) => dayKey >= startWeekKey && dayKey <= endKey),
    monthly: buildStatsBucket(activityHistory, (dayKey) => dayKey.startsWith(monthPrefix)),
    yearly: buildStatsBucket(activityHistory, (dayKey) => dayKey.startsWith(yearPrefix)),
    total: buildStatsBucket(activityHistory),
    streakCount: getCurrentStreakCount(activityHistory),
  };
}

async function getUserStatsMap(userIds) {
  const uniqueIds = Array.from(new Set(userIds.map((id) => Number(id)).filter(Number.isFinite)));
  if (uniqueIds.length === 0) return new Map();

  const result = await query(
    `
      SELECT u.id, u.username, u.plan, a.state_json
      FROM users u
      LEFT JOIN app_state a ON a.user_id = u.id
      WHERE u.id = ANY($1::int[])
    `,
    [uniqueIds]
  );

  const statsMap = new Map();
  result.rows.forEach((row) => {
    statsMap.set(Number(row.id), {
      userId: Number(row.id),
      username: String(row.username || ""),
      plan: normalizePlan(row.plan),
      stats: getSocialStatsFromState(row.state_json),
    });
  });
  return statsMap;
}

socialRouter.get("/overview", async (req, res) => {
  const userId = Number(req.authUser.id);

  try {
    const friendshipsResult = await query(
      `
        SELECT
          f.id,
          f.user_low_id,
          f.user_high_id,
          f.requested_by,
          f.status,
          f.created_at,
          f.responded_at,
          u_from.username AS from_username,
          u_to.username AS to_username
        FROM friendships f
        LEFT JOIN users u_from ON u_from.id = f.requested_by
        LEFT JOIN users u_to ON u_to.id = CASE
          WHEN f.requested_by = f.user_low_id THEN f.user_high_id
          ELSE f.user_low_id
        END
        WHERE f.user_low_id = $1 OR f.user_high_id = $1
        ORDER BY f.created_at DESC
      `,
      [userId]
    );

    const rows = friendshipsResult.rows || [];
    const friendIds = [];
    const incomingRequests = [];
    const outgoingRequests = [];
    const acceptedLinks = [];

    rows.forEach((row) => {
      const lowId = Number(row.user_low_id);
      const highId = Number(row.user_high_id);
      const requesterId = Number(row.requested_by);
      const friendUserId = lowId === userId ? highId : lowId;
      const isRequester = requesterId === userId;
      const status = String(row.status || "");
      const friendUsername = isRequester
        ? String(row.to_username || "")
        : String(row.from_username || "");

      if (status === "accepted") {
        friendIds.push(friendUserId);
        acceptedLinks.push({
          friendshipId: Number(row.id),
          userId: friendUserId,
          since: row.responded_at || row.created_at || null,
        });
        return;
      }

      if (status !== "pending") return;

      if (isRequester) {
        outgoingRequests.push({
          requestId: Number(row.id),
          userId: friendUserId,
          username: friendUsername,
          createdAt: row.created_at || null,
        });
      } else {
        incomingRequests.push({
          requestId: Number(row.id),
          userId: friendUserId,
          username: friendUsername,
          createdAt: row.created_at || null,
        });
      }
    });

    const statsMap = await getUserStatsMap([userId, ...friendIds]);
    const currentUserStats = statsMap.get(userId) || {
      userId,
      username: req.authUser.username,
      plan: normalizePlan(req.authUser.plan),
      stats: {
        weekly: createEmptyStatTotals(),
        monthly: createEmptyStatTotals(),
        yearly: createEmptyStatTotals(),
        total: createEmptyStatTotals(),
        streakCount: 0,
      },
    };

    const friends = acceptedLinks.map((link) => {
      const profile = statsMap.get(link.userId) || {
        userId: link.userId,
        username: `user_${link.userId}`,
        plan: "free",
        stats: {
          weekly: createEmptyStatTotals(),
          monthly: createEmptyStatTotals(),
          yearly: createEmptyStatTotals(),
          total: createEmptyStatTotals(),
          streakCount: 0,
        },
      };
      return {
        friendshipId: link.friendshipId,
        userId: link.userId,
        username: profile.username,
        plan: profile.plan,
        since: link.since,
        stats: profile.stats,
      };
    });

    const currentUserPlan = normalizePlan(currentUserStats.plan);
    const leaderboardProfiles = [currentUserStats, ...friends]
      .filter(Boolean)
      .filter((profile) => normalizePlan(profile.plan) === currentUserPlan);

    res.json({
      currentUser: currentUserStats,
      friends,
      leaderboardProfiles,
      incomingRequests,
      outgoingRequests,
    });
  } catch {
    res.status(500).json({ error: "social-overview-failed" });
  }
});

socialRouter.post("/requests", async (req, res) => {
  const userId = Number(req.authUser.id);
  const username = normalizeUsername(req.body?.username);
  const now = new Date().toISOString();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    res.status(400).json({ error: "invalid-username" });
    return;
  }

  try {
    const targetUserResult = await query("SELECT id, username FROM users WHERE username = $1", [username]);
    const targetUser = targetUserResult.rows[0];
    if (!targetUser) {
      res.status(404).json({ error: "user-not-found" });
      return;
    }

    const targetUserId = Number(targetUser.id);
    if (targetUserId === userId) {
      res.status(400).json({ error: "cannot-add-self" });
      return;
    }

    const { lowId, highId } = getPairIds(userId, targetUserId);
    const existingResult = await query(
      "SELECT id, status, requested_by FROM friendships WHERE user_low_id = $1 AND user_high_id = $2",
      [lowId, highId]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      const status = String(existing.status || "");
      if (status === "accepted") {
        res.status(409).json({ error: "already-friends" });
        return;
      }
      if (status === "pending") {
        res.status(409).json({ error: "request-already-pending" });
        return;
      }
      await query(
        `
          UPDATE friendships
          SET status = 'pending', requested_by = $3, created_at = $4, responded_at = NULL
          WHERE user_low_id = $1 AND user_high_id = $2
        `,
        [lowId, highId, userId, now]
      );
      res.status(201).json({ ok: true });
      return;
    }

    await query(
      `
        INSERT INTO friendships (user_low_id, user_high_id, requested_by, status, created_at)
        VALUES ($1, $2, $3, 'pending', $4)
      `,
      [lowId, highId, userId, now]
    );

    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "social-request-create-failed" });
  }
});

socialRouter.post("/requests/:requestId/respond", async (req, res) => {
  const userId = Number(req.authUser.id);
  const requestId = Number(req.params.requestId);
  const action = String(req.body?.action || "").trim().toLowerCase();
  const now = new Date().toISOString();

  if (!Number.isFinite(requestId)) {
    res.status(400).json({ error: "invalid-request-id" });
    return;
  }
  if (!["accept", "decline"].includes(action)) {
    res.status(400).json({ error: "invalid-action" });
    return;
  }

  try {
    const result = await query(
      `
        SELECT id, user_low_id, user_high_id, requested_by, status
        FROM friendships
        WHERE id = $1
      `,
      [requestId]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "request-not-found" });
      return;
    }
    if (String(row.status) !== "pending") {
      res.status(409).json({ error: "request-not-pending" });
      return;
    }
    if (Number(row.requested_by) === userId) {
      res.status(403).json({ error: "cannot-respond-own-request" });
      return;
    }
    const isParticipant = Number(row.user_low_id) === userId || Number(row.user_high_id) === userId;
    if (!isParticipant) {
      res.status(403).json({ error: "not-request-participant" });
      return;
    }

    const nextStatus = action === "accept" ? "accepted" : "declined";
    await query(
      `
        UPDATE friendships
        SET status = $2, responded_at = $3
        WHERE id = $1
      `,
      [requestId, nextStatus, now]
    );

    res.json({ ok: true, status: nextStatus });
  } catch {
    res.status(500).json({ error: "social-request-respond-failed" });
  }
});

socialRouter.delete("/requests/:requestId", async (req, res) => {
  const userId = Number(req.authUser.id);
  const requestId = Number(req.params.requestId);

  if (!Number.isFinite(requestId)) {
    res.status(400).json({ error: "invalid-request-id" });
    return;
  }

  try {
    const result = await query(
      `
        SELECT id, requested_by, status
        FROM friendships
        WHERE id = $1
      `,
      [requestId]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "request-not-found" });
      return;
    }
    if (String(row.status) !== "pending") {
      res.status(409).json({ error: "request-not-pending" });
      return;
    }
    if (Number(row.requested_by) !== userId) {
      res.status(403).json({ error: "cannot-cancel-others-request" });
      return;
    }

    await query("DELETE FROM friendships WHERE id = $1", [requestId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "social-request-cancel-failed" });
  }
});

socialRouter.delete("/friends/:friendUserId", async (req, res) => {
  const userId = Number(req.authUser.id);
  const friendUserId = Number(req.params.friendUserId);

  if (!Number.isFinite(friendUserId)) {
    res.status(400).json({ error: "invalid-friend-id" });
    return;
  }
  if (friendUserId === userId) {
    res.status(400).json({ error: "invalid-friend-id" });
    return;
  }

  const { lowId, highId } = getPairIds(userId, friendUserId);

  try {
    const result = await query(
      `
        DELETE FROM friendships
        WHERE user_low_id = $1 AND user_high_id = $2 AND status = 'accepted'
      `,
      [lowId, highId]
    );

    if (!result.rowCount) {
      res.status(404).json({ error: "friendship-not-found" });
      return;
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "social-remove-friend-failed" });
  }
});
