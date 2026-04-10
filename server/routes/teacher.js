import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

export const teacherRouter = Router();

teacherRouter.use(requireAuth);

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : 0;
}

function parseWindowDays(value, fallbackDays = 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackDays;
  const floored = Math.floor(parsed);
  return Math.max(1, Math.min(365, floored));
}

async function isTeacherAssignedToCode(userId, codeId) {
  const result = await query(
    `
      SELECT 1
      FROM school_teacher_assignments
      WHERE user_id = $1 AND code_id = $2
      LIMIT 1
    `,
    [userId, codeId]
  );
  return Boolean(result.rows[0]);
}

teacherRouter.get("/cohorts", async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  const role = String(req.authUser?.role || "student").trim().toLowerCase();

  if (role !== "teacher" && role !== "admin") {
    res.status(403).json({ error: "teacher-role-required" });
    return;
  }

  try {
    const result = await query(
      `
        SELECT
          c.id,
          c.school_name,
          c.code,
          a.assigned_at,
          COUNT(r.user_id)::int AS student_count
        FROM school_teacher_assignments a
        JOIN school_access_codes c ON c.id = a.code_id
        LEFT JOIN school_code_redemptions r ON r.code_id = c.id
        WHERE a.user_id = $1
        GROUP BY c.id, a.assigned_at
        ORDER BY a.assigned_at DESC, c.id DESC
      `,
      [userId]
    );

    res.json({
      userId,
      role,
      cohorts: result.rows.map((row) => ({
        codeId: Number(row.id),
        schoolName: String(row.school_name || ""),
        code: String(row.code || ""),
        assignedAt: row.assigned_at || null,
        studentCount: Number(row.student_count || 0),
      })),
    });
  } catch {
    res.status(500).json({ error: "teacher-cohorts-list-failed" });
  }
});

teacherRouter.get("/cohorts/:codeId/word-adds/summary", async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  const role = String(req.authUser?.role || "student").trim().toLowerCase();
  const codeId = parsePositiveInt(req.params.codeId);
  const days = parseWindowDays(req.query?.days, 30);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  if (role !== "teacher" && role !== "admin") {
    res.status(403).json({ error: "teacher-role-required" });
    return;
  }
  if (!codeId) {
    res.status(400).json({ error: "invalid-code-id" });
    return;
  }

  try {
    if (role !== "admin") {
      const assigned = await isTeacherAssignedToCode(userId, codeId);
      if (!assigned) {
        res.status(403).json({ error: "teacher-cohort-access-denied" });
        return;
      }
    }

    const codeResult = await query(
      "SELECT id, school_name, code FROM school_access_codes WHERE id = $1",
      [codeId]
    );
    const codeRow = codeResult.rows[0];
    if (!codeRow) {
      res.status(404).json({ error: "school-code-not-found" });
      return;
    }

    const totalsResult = await query(
      `
        SELECT
          COUNT(*)::int AS total_words_added,
          COUNT(DISTINCT user_id)::int AS unique_students,
          COUNT(DISTINCT word_normalized)::int AS unique_words
        FROM word_add_events
        WHERE code_id = $1
          AND added_at >= $2
      `,
      [codeId, sinceIso]
    );
    const totalsRow = totalsResult.rows[0] || {};

    const levelsResult = await query(
      `
        SELECT
          COALESCE(NULLIF(cefr_level, ''), 'unassigned') AS level,
          COUNT(*)::int AS count
        FROM word_add_events
        WHERE code_id = $1
          AND added_at >= $2
        GROUP BY COALESCE(NULLIF(cefr_level, ''), 'unassigned')
        ORDER BY count DESC, level ASC
      `,
      [codeId, sinceIso]
    );

    const topWordsResult = await query(
      `
        SELECT
          word_normalized AS word,
          COUNT(*)::int AS count
        FROM word_add_events
        WHERE code_id = $1
          AND added_at >= $2
        GROUP BY word_normalized
        ORDER BY count DESC, word_normalized ASC
        LIMIT 30
      `,
      [codeId, sinceIso]
    );

    const studentBreakdownResult = await query(
      `
        SELECT
          e.user_id,
          u.username,
          COUNT(*)::int AS words_added,
          COUNT(DISTINCT e.word_normalized)::int AS unique_words
        FROM word_add_events e
        JOIN users u ON u.id = e.user_id
        WHERE e.code_id = $1
          AND e.added_at >= $2
        GROUP BY e.user_id, u.username
        ORDER BY words_added DESC, unique_words DESC, e.user_id ASC
        LIMIT 100
      `,
      [codeId, sinceIso]
    );

    res.json({
      codeId,
      schoolName: String(codeRow.school_name || ""),
      code: String(codeRow.code || ""),
      windowDays: days,
      since: sinceIso,
      totals: {
        totalWordsAdded: Number(totalsRow.total_words_added || 0),
        uniqueStudents: Number(totalsRow.unique_students || 0),
        uniqueWords: Number(totalsRow.unique_words || 0),
      },
      cefrDistribution: levelsResult.rows.map((row) => ({
        level: String(row.level || "unassigned"),
        count: Number(row.count || 0),
      })),
      topWords: topWordsResult.rows.map((row) => ({
        word: String(row.word || ""),
        count: Number(row.count || 0),
      })),
      students: studentBreakdownResult.rows.map((row) => ({
        userId: Number(row.user_id),
        username: String(row.username || ""),
        wordsAdded: Number(row.words_added || 0),
        uniqueWords: Number(row.unique_words || 0),
      })),
    });
  } catch {
    res.status(500).json({ error: "teacher-word-add-summary-failed" });
  }
});

teacherRouter.get("/cohorts/:codeId/word-adds/trends", async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  const role = String(req.authUser?.role || "student").trim().toLowerCase();
  const codeId = parsePositiveInt(req.params.codeId);
  const days = parseWindowDays(req.query?.days, 30);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  if (role !== "teacher" && role !== "admin") {
    res.status(403).json({ error: "teacher-role-required" });
    return;
  }
  if (!codeId) {
    res.status(400).json({ error: "invalid-code-id" });
    return;
  }

  try {
    if (role !== "admin") {
      const assigned = await isTeacherAssignedToCode(userId, codeId);
      if (!assigned) {
        res.status(403).json({ error: "teacher-cohort-access-denied" });
        return;
      }
    }

    const rowsResult = await query(
      `
        SELECT
          SUBSTRING(added_at FROM 1 FOR 10) AS day_key,
          COUNT(*)::int AS words_added,
          COUNT(DISTINCT user_id)::int AS active_students
        FROM word_add_events
        WHERE code_id = $1
          AND added_at >= $2
        GROUP BY SUBSTRING(added_at FROM 1 FOR 10)
        ORDER BY day_key ASC
      `,
      [codeId, sinceIso]
    );

    res.json({
      codeId,
      windowDays: days,
      since: sinceIso,
      days: rowsResult.rows.map((row) => ({
        dayKey: String(row.day_key || ""),
        wordsAdded: Number(row.words_added || 0),
        activeStudents: Number(row.active_students || 0),
      })),
    });
  } catch {
    res.status(500).json({ error: "teacher-word-add-trends-failed" });
  }
});
