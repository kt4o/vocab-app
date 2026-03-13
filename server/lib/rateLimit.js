import { query } from "../db/client.js";

function getSafePositiveInt(value, fallbackValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackValue;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : fallbackValue;
}

function getNowIso() {
  return new Date().toISOString();
}

export async function consumeWriteRateLimit({
  key,
  windowMs,
  maxAttempts,
  nowMs = Date.now(),
}) {
  const safeWindowMs = getSafePositiveInt(windowMs, 15 * 60 * 1000);
  const safeMaxAttempts = getSafePositiveInt(maxAttempts, 180);
  const nowIso = getNowIso();

  const result = await query(
    `
      INSERT INTO api_rate_limits (key, window_start_ms, attempts, updated_at)
      VALUES ($1, $2, 1, $3)
      ON CONFLICT (key)
      DO UPDATE SET
        window_start_ms = CASE
          WHEN ($2 - api_rate_limits.window_start_ms) >= $4 THEN $2
          ELSE api_rate_limits.window_start_ms
        END,
        attempts = CASE
          WHEN ($2 - api_rate_limits.window_start_ms) >= $4 THEN 1
          ELSE api_rate_limits.attempts + 1
        END,
        updated_at = $3
      RETURNING window_start_ms, attempts;
    `,
    [key, nowMs, nowIso, safeWindowMs]
  );

  const row = result?.rows?.[0] || {};
  const attempts = Math.max(1, Math.floor(Number(row.attempts) || 1));
  const windowStartMs = Math.max(0, Math.floor(Number(row.window_start_ms) || nowMs));
  const elapsedMs = Math.max(0, nowMs - windowStartMs);
  const retryAfterSeconds = Math.max(1, Math.ceil((safeWindowMs - elapsedMs) / 1000));

  return {
    isAllowed: attempts <= safeMaxAttempts,
    attempts,
    retryAfterSeconds,
  };
}
