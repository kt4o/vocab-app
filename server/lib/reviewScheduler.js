function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function roundToInt(value, fallback = 1) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function addDaysIso(baseIso, days) {
  const baseMs = Date.parse(baseIso);
  const safeBaseMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(safeBaseMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export function computeNextReviewState(previousState, rating, nowIso = new Date().toISOString()) {
  const normalizedRating = String(rating || "").trim().toLowerCase();
  const previousEaseFactor = clampNumber(previousState?.easeFactor, 1.7, 3.0);
  const previousIntervalDays = roundToInt(previousState?.intervalDays, 1);
  const previousSuccessStreak = Math.max(0, Math.floor(Number(previousState?.successStreak) || 0));
  const previousLapseCount = Math.max(0, Math.floor(Number(previousState?.lapseCount) || 0));
  const previousDueCount = Math.max(0, Math.floor(Number(previousState?.dueCount) || 0));

  let easeFactor = previousEaseFactor;
  let intervalDays = previousIntervalDays;
  let successStreak = previousSuccessStreak;
  let lapseCount = previousLapseCount;

  if (normalizedRating === "again") {
    successStreak = 0;
    lapseCount += 1;
    intervalDays = 1;
    easeFactor = clampNumber(previousEaseFactor - 0.2, 1.7, 3.0);
  } else if (normalizedRating === "hard") {
    successStreak += 1;
    intervalDays = Math.max(1, roundToInt((previousIntervalDays || 1) * 1.2, 1));
    easeFactor = clampNumber(previousEaseFactor - 0.05, 1.8, 3.0);
  } else if (normalizedRating === "easy") {
    successStreak += 1;
    intervalDays =
      successStreak <= 1
        ? 5
        : Math.max(2, roundToInt(Math.max(2, previousIntervalDays) * previousEaseFactor * 1.25, 5));
    easeFactor = clampNumber(previousEaseFactor + 0.05, 1.7, 3.0);
  } else {
    successStreak += 1;
    intervalDays =
      successStreak <= 1
        ? 3
        : Math.max(2, roundToInt(Math.max(2, previousIntervalDays) * previousEaseFactor, 3));
  }

  return {
    nextReviewAt: addDaysIso(nowIso, intervalDays),
    lastReviewedAt: nowIso,
    lastRating: normalizedRating === "again" || normalizedRating === "hard" || normalizedRating === "easy" ? normalizedRating : "good",
    successStreak,
    lapseCount,
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays,
    dueCount: previousDueCount + 1,
    updatedAt: nowIso,
  };
}
