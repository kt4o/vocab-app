import crypto from "node:crypto";
import { Router } from "express";
import { pool, query } from "../db/client.js";
import { sendPasswordResetCodeEmail, sendVerificationCodeEmail } from "../lib/email.js";
import { getAuthTokenFromRequest, requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const authRateBuckets = new Map();
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000;
const DEFAULT_LEGAL_VERSION = String(process.env.LEGAL_VERSION || "2026-03-14").trim() || "2026-03-14";
const SESSION_COOKIE_NAME = String(process.env.AUTH_COOKIE_NAME || "vocab_session").trim() || "vocab_session";

function resolveCookieSameSite() {
  const configured = String(process.env.AUTH_COOKIE_SAMESITE || "lax")
    .trim()
    .toLowerCase();
  if (configured === "strict" || configured === "none") return configured;
  return "lax";
}

function shouldUseSecureCookies(req) {
  const forceSecure = String(process.env.AUTH_COOKIE_SECURE || "")
    .trim()
    .toLowerCase();
  if (forceSecure === "true") return true;
  if (forceSecure === "false") return false;

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .trim()
    .toLowerCase();
  if (forwardedProto === "https") return true;
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function getSessionCookieOptions(req, { clear = false } = {}) {
  const sameSite = resolveCookieSameSite();
  const secure = shouldUseSecureCookies(req) || sameSite === "none";
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: clear ? 0 : 1000 * 60 * 60 * 24 * 30,
  };
}

function setSessionCookie(req, res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(req));
}

function clearSessionCookie(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(req, { clear: true }));
}

function getRequesterKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwardedFor || req.ip || "unknown";
}

function enforceRateLimit(req, res, { bucket, maxAttempts, windowMs }) {
  const key = `${bucket}:${getRequesterKey(req)}`;
  const now = Date.now();
  const current = authRateBuckets.get(key) || [];
  const recent = current.filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    res.status(429).json({ error: "rate-limited", retryAfterSeconds });
    return false;
  }
  recent.push(now);
  authRateBuckets.set(key, recent);
  return true;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

const DEFAULT_BANNED_USERNAME_TOKENS = [
  "fuck",
  "fuk",
  "phuck",
  "fucker",
  "fucking",
  "fck",
  "fcker",
  "fcking",
  "fucc",
  "fuq",
  "fux",
  "fuker",
  "fuking",
  "motherfuker",
  "motherfuking",
  "motherfucker",
  "mf",
  "shit",
  "sh1t",
  "bullshit",
  "shithead",
  "shitface",
  "shitbag",
  "shitter",
  "shitty",
  "shyt",
  "sh1tty",
  "bitch",
  "biatch",
  "b1tch",
  "bi7ch",
  "bitchass",
  "b!tch",
  "btch",
  "beotch",
  "bytch",
  "bich",
  "bastard",
  "bastardo",
  "bastid",
  "cunt",
  "c0unt",
  "kunt",
  "cunty",
  "cuntface",
  "nigger",
  "nigga",
  "n1gger",
  "n1gga",
  "ni99er",
  "ni99a",
  "faggot",
  "fag",
  "f4ggot",
  "fa99ot",
  "spic",
  "chink",
  "kike",
  "gook",
  "wetback",
  "beaner",
  "raghead",
  "sandnigger",
  "dyke",
  "tranny",
  "coon",
  "whore",
  "wh0re",
  "wh0r3",
  "whoer",
  "h0e",
  "hoe",
  "slut",
  "slutty",
  "slvt",
  "skank",
  "tramp",
  "rape",
  "rapist",
  "raper",
  "rapey",
  "molester",
  "molest",
  "pedo",
  "ped0",
  "pedophile",
  "paedophile",
  "childmolester",
  "incest",
  "bestiality",
  "zoophile",
  "necrophile",
  "porn",
  "pornhub",
  "xnxx",
  "xvideos",
  "onlyfans",
  "blowjob",
  "handjob",
  "rimjob",
  "titfuck",
  "facefuck",
  "deepthroat",
  "cumshot",
  "creampie",
  "jizz",
  "semen",
  "dildo",
  "vibrator",
  "bdsm",
  "fetish",
  "nudes",
  "nakedpics",
  "sexting",
  "dick",
  "cock",
  "pussy",
  "asshole",
  "ass",
  "retard",
  "retarded",
  "ret4rd",
  "ret@rd",
  "spazz",
  "mongoloid",
  "killyourself",
  "killurself",
  "kys",
  "suicide",
  "selfharm",
  "terrorist",
  "isis",
  "isislover",
  "alqaeda",
  "hamas",
  "nazism",
  "whitepower",
  "heilhitler",
  "genocide",
  "massacre",
  "methhead",
  "cocaine",
  "heroin",
  "crackhead",
  "fentanyl",
  "drugdealer",
  "dealer",
  "nazi",
  "hitler",
  "kkk",
];

function parseExtraBlockedUsernameTokens(rawValue) {
  return String(rawValue || "")
    .split(/[\n,]+/)
    .map((token) => token.trim().toLowerCase())
    .map((token) => token.replace(/[^a-z0-9@$!+|]/g, ""))
    .filter((token) => token.length >= 2)
    .slice(0, 2000);
}

const EXTRA_BANNED_USERNAME_TOKENS = parseExtraBlockedUsernameTokens(
  process.env.USERNAME_BLOCKLIST_EXTRA
);

const BANNED_USERNAME_TOKENS = Array.from(
  new Set([...DEFAULT_BANNED_USERNAME_TOKENS, ...EXTRA_BANNED_USERNAME_TOKENS])
);

const SHORT_BANNED_USERNAME_TOKENS = new Set(
  BANNED_USERNAME_TOKENS.filter((token) => token.length <= 3)
);

function normalizeModerationChunk(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[013456789@$!+|]/g, (char) => {
      if (char === "0") return "o";
      if (char === "1" || char === "!" || char === "|") return "i";
      if (char === "3") return "e";
      if (char === "4" || char === "@") return "a";
      if (char === "5" || char === "$") return "s";
      if (char === "6" || char === "8" || char === "9") return "g";
      if (char === "7" || char === "+") return "t";
      if (char === "2") return "z";
      return char;
    })
    .replace(/[^a-z]/g, "");
}

function normalizeUsernameForModeration(value) {
  const raw = normalizeModerationChunk(value);
  const collapsed = raw.replace(/(.)\1{1,}/g, "$1");
  const partVariants = String(value || "")
    .toLowerCase()
    .split(/_+/)
    .map((part) => normalizeModerationChunk(part))
    .filter(Boolean)
    .map((part) => ({
      raw: part,
      collapsed: part.replace(/(.)\1{1,}/g, "$1"),
    }));
  return { raw, collapsed, partVariants };
}

function isAppropriateUsername(value) {
  const normalized = normalizeUsernameForModeration(value);
  if (!normalized.raw) return false;

  const hasLongTokenMatch = BANNED_USERNAME_TOKENS.filter((token) => token.length > 3).some(
    (token) => normalized.raw.includes(token) || normalized.collapsed.includes(token)
  );
  if (hasLongTokenMatch) return false;

  // Short tokens are stricter to reduce false positives (e.g. "classmate").
  const hasShortTokenMatch = Array.from(SHORT_BANNED_USERNAME_TOKENS).some((token) =>
    normalized.partVariants.some((part) => {
      if (part.raw === token || part.collapsed === token) return true;
      const maxPaddedLength = token.length + 2;
      const startsWithToken =
        (part.raw.startsWith(token) || part.collapsed.startsWith(token)) &&
        Math.min(part.raw.length, part.collapsed.length) <= maxPaddedLength;
      const endsWithToken =
        (part.raw.endsWith(token) || part.collapsed.endsWith(token)) &&
        Math.min(part.raw.length, part.collapsed.length) <= maxPaddedLength;
      return startsWithToken || endsWithToken;
    })
  );

  return !hasShortTokenMatch;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePlan(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "pro"
    ? "pro"
    : "free";
}

function normalizeSubscriptionStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isCanceledSubscriptionStatus(value) {
  const status = normalizeSubscriptionStatus(value);
  return status === "canceled" || status === "cancelled";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashEmailVerificationCode(email, code) {
  return crypto
    .createHash("sha256")
    .update(`${email}:${String(code || "").trim()}`)
    .digest("hex");
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function isIsoDateInFuture(value) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

function getRetryAfterFromIso(isoValue, cooldownMs) {
  const timestamp = new Date(String(isoValue || "")).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs >= cooldownMs) return 0;
  return Math.ceil((cooldownMs - elapsedMs) / 1000);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120_000, 64, "sha512").toString("hex");
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = hashPassword(password, salt);
  return `${salt}:${digest}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, expected] = String(passwordHash || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function issueToken() {
  return crypto.randomBytes(32).toString("hex");
}

function issueEmailCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getCurrentDayKey(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function trackRetentionEvent(userId, eventName = "session_start", metadata = {}) {
  const safeUserId = Number(userId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) return;
  const normalizedEventName = String(eventName || "").trim().toLowerCase();
  const safeEventName =
    normalizedEventName === "register" || normalizedEventName === "login"
      ? normalizedEventName
      : "session_start";
  const now = new Date().toISOString();
  const dayKey = getCurrentDayKey(new Date(now));
  const safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};

  try {
    await query(
      `
        INSERT INTO retention_events (user_id, event_name, event_day_key, event_at, metadata_json)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (user_id, event_name, event_day_key) DO NOTHING
      `,
      [safeUserId, safeEventName, dayKey, now, JSON.stringify(safeMetadata)]
    );
  } catch {
    // Retention tracking should never block auth operations.
  }
}

authRouter.post("/register/request-email-code", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "register-request-code", maxAttempts: 8, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }

  try {
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows[0]) {
      res.status(409).json({ error: "email-taken" });
      return;
    }

    const recentVerification = await query(
      "SELECT updated_at FROM email_verifications WHERE email = $1",
      [email]
    );
    const retryAfterSeconds = getRetryAfterFromIso(
      recentVerification.rows[0]?.updated_at,
      EMAIL_CODE_COOLDOWN_MS
    );
    if (retryAfterSeconds > 0) {
      res.status(429).json({ error: "verification-code-cooldown", retryAfterSeconds });
      return;
    }

    const now = new Date();
    const code = issueEmailCode();
    const codeHash = hashEmailVerificationCode(email, code);
    const codeExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    await query(
      `
        INSERT INTO email_verifications (
          email, code_hash, code_expires_at, verified_token_hash, verified_token_expires_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, NULL, NULL, $4, $4)
        ON CONFLICT(email) DO UPDATE
        SET
          code_hash = EXCLUDED.code_hash,
          code_expires_at = EXCLUDED.code_expires_at,
          verified_token_hash = NULL,
          verified_token_expires_at = NULL,
          updated_at = EXCLUDED.updated_at
      `,
      [email, codeHash, codeExpiresAt, nowIso]
    );

    await sendVerificationCodeEmail(email, code);
    res.json({ ok: true, delivery: "smtp" });
  } catch (error) {
    if (String(error?.code || "") === "EMAIL_TRANSPORT_NOT_CONFIGURED") {
      res.status(500).json({ error: "email-delivery-not-configured" });
      return;
    }
    res.status(500).json({ error: "request-email-code-failed" });
  }
});

authRouter.post("/register/verify-email-code", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "register-verify-code", maxAttempts: 12, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "invalid-verification-code" });
    return;
  }

  try {
    const rowResult = await query(
      "SELECT email, code_hash, code_expires_at FROM email_verifications WHERE email = $1",
      [email]
    );
    const record = rowResult.rows[0];
    if (!record) {
      res.status(400).json({ error: "verification-session-missing" });
      return;
    }
    if (!isIsoDateInFuture(record.code_expires_at)) {
      res.status(400).json({ error: "verification-code-expired" });
      return;
    }

    const expectedCodeHash = String(record.code_hash || "");
    const actualCodeHash = hashEmailVerificationCode(email, code);
    if (
      !expectedCodeHash ||
      !crypto.timingSafeEqual(Buffer.from(expectedCodeHash), Buffer.from(actualCodeHash))
    ) {
      res.status(400).json({ error: "invalid-verification-code" });
      return;
    }

    const verifiedToken = issueToken();
    const verifiedTokenHash = hashVerificationToken(verifiedToken);
    const verifiedTokenExpiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    await query(
      `
        UPDATE email_verifications
        SET verified_token_hash = $1, verified_token_expires_at = $2, updated_at = $3
        WHERE email = $4
      `,
      [verifiedTokenHash, verifiedTokenExpiresAt, now, email]
    );

    res.json({ ok: true, verifiedEmailToken: verifiedToken });
  } catch {
    res.status(500).json({ error: "verify-email-code-failed" });
  }
});

authRouter.post("/register", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "register-complete", maxAttempts: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const email = normalizeEmail(req.body?.email);
  const verifiedEmailToken = String(req.body?.verifiedEmailToken || "").trim();
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const marketingOptIn = Boolean(req.body?.marketingOptIn);
  const acceptedLegal = Boolean(req.body?.acceptedLegal);
  const legalVersionRaw = String(req.body?.legalVersion || DEFAULT_LEGAL_VERSION).trim();
  const legalVersion = (legalVersionRaw || DEFAULT_LEGAL_VERSION).slice(0, 64);

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }
  if (!isValidUsername(username)) {
    res.status(400).json({ error: "invalid-username" });
    return;
  }
  if (!isAppropriateUsername(username)) {
    res.status(400).json({ error: "inappropriate-username" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "weak-password" });
    return;
  }
  if (!acceptedLegal) {
    res.status(400).json({ error: "legal-not-accepted" });
    return;
  }
  if (!verifiedEmailToken) {
    res.status(400).json({ error: "email-not-verified" });
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = createPasswordHash(password);
  const token = issueToken();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const verificationResult = await client.query(
      `
        SELECT verified_token_hash, verified_token_expires_at
        FROM email_verifications
        WHERE email = $1
      `,
      [email]
    );
    const verificationRow = verificationResult.rows[0];
    const expectedVerificationTokenHash = String(verificationRow?.verified_token_hash || "");
    const actualVerificationTokenHash = hashVerificationToken(verifiedEmailToken);
    const isValidVerificationToken =
      Boolean(expectedVerificationTokenHash) &&
      isIsoDateInFuture(verificationRow?.verified_token_expires_at) &&
      crypto.timingSafeEqual(
        Buffer.from(expectedVerificationTokenHash),
        Buffer.from(actualVerificationTokenHash)
      );
    if (!isValidVerificationToken) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "email-not-verified" });
      return;
    }

    const existing = await client.query("SELECT id, username, email FROM users WHERE username = $1 OR email = $2", [
      username,
      email,
    ]);
    if (existing.rows[0]) {
      await client.query("ROLLBACK");
      const existingUser = existing.rows[0];
      const conflictError =
        String(existingUser?.email || "").toLowerCase() === email ? "email-taken" : "username-taken";
      res.status(409).json({ error: conflictError });
      return;
    }

    const userInsert = await client.query(
      `
        INSERT INTO users (
          username,
          email,
          password_hash,
          created_at,
          auth_token,
          auth_token_created_at,
          marketing_opt_in,
          marketing_opt_in_updated_at,
          legal_accepted_at,
          legal_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [username, email, passwordHash, now, token, now, marketingOptIn, now, now, legalVersion]
    );
    const userId = Number(userInsert.rows[0].id);

    await client.query(
      `
        INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
        VALUES ($1, 0, 0, 1, '[]'::jsonb, $2)
      `,
      [userId, now]
    );
    await client.query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, '{}'::jsonb, $2)
      `,
      [userId, now]
    );

    await client.query("DELETE FROM email_verifications WHERE email = $1", [email]);
    await client.query("COMMIT");
    await trackRetentionEvent(userId, "register", { source: "auth/register" });
    await trackRetentionEvent(userId, "session_start", { source: "auth/register" });
    setSessionCookie(req, res, token);
    res.status(201).json({ userId, username, token });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      const conflictTarget = String(error?.constraint || "").toLowerCase();
      if (conflictTarget.includes("email")) {
        res.status(409).json({ error: "email-taken" });
        return;
      }
      res.status(409).json({ error: "username-taken" });
      return;
    }
    res.status(500).json({ error: "register-failed" });
  } finally {
    client.release();
  }
});

authRouter.post("/password-reset/request-code", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "password-reset-request", maxAttempts: 8, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }

  try {
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (!existingUser.rows[0]) {
      // Prevent account enumeration.
      res.json({ ok: true, delivery: "smtp" });
      return;
    }

    const recentReset = await query("SELECT updated_at FROM password_resets WHERE email = $1", [email]);
    const retryAfterSeconds = getRetryAfterFromIso(recentReset.rows[0]?.updated_at, EMAIL_CODE_COOLDOWN_MS);
    if (retryAfterSeconds > 0) {
      res.status(429).json({ error: "password-reset-code-cooldown", retryAfterSeconds });
      return;
    }

    const code = issueEmailCode();
    const codeHash = hashEmailVerificationCode(email, code);
    const now = new Date();
    const nowIso = now.toISOString();
    const codeExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    await query(
      `
        INSERT INTO password_resets (
          email, code_hash, code_expires_at, reset_token_hash, reset_token_expires_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, NULL, NULL, $4, $4)
        ON CONFLICT(email) DO UPDATE
        SET
          code_hash = EXCLUDED.code_hash,
          code_expires_at = EXCLUDED.code_expires_at,
          reset_token_hash = NULL,
          reset_token_expires_at = NULL,
          updated_at = EXCLUDED.updated_at
      `,
      [email, codeHash, codeExpiresAt, nowIso]
    );

    await sendPasswordResetCodeEmail(email, code);
    res.json({ ok: true, delivery: "smtp" });
  } catch (error) {
    if (String(error?.code || "") === "EMAIL_TRANSPORT_NOT_CONFIGURED") {
      res.status(500).json({ error: "email-delivery-not-configured" });
      return;
    }
    res.status(500).json({ error: "password-reset-request-failed" });
  }
});

authRouter.post("/password-reset/verify-code", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "password-reset-verify", maxAttempts: 12, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "invalid-verification-code" });
    return;
  }

  try {
    const rowResult = await query(
      "SELECT code_hash, code_expires_at FROM password_resets WHERE email = $1",
      [email]
    );
    const record = rowResult.rows[0];
    if (!record) {
      res.status(400).json({ error: "password-reset-session-missing" });
      return;
    }
    if (!isIsoDateInFuture(record.code_expires_at)) {
      res.status(400).json({ error: "verification-code-expired" });
      return;
    }

    const expectedCodeHash = String(record.code_hash || "");
    const actualCodeHash = hashEmailVerificationCode(email, code);
    if (
      !expectedCodeHash ||
      !crypto.timingSafeEqual(Buffer.from(expectedCodeHash), Buffer.from(actualCodeHash))
    ) {
      res.status(400).json({ error: "invalid-verification-code" });
      return;
    }

    const resetToken = issueToken();
    const resetTokenHash = hashVerificationToken(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    await query(
      `
        UPDATE password_resets
        SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = $3
        WHERE email = $4
      `,
      [resetTokenHash, resetTokenExpiresAt, now, email]
    );

    res.json({ ok: true, resetToken });
  } catch {
    res.status(500).json({ error: "password-reset-verify-failed" });
  }
});

authRouter.post("/password-reset/complete", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "password-reset-complete", maxAttempts: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const email = normalizeEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || "").trim();
  const nextPassword = String(req.body?.password || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }
  if (!resetToken) {
    res.status(400).json({ error: "reset-session-invalid" });
    return;
  }
  if (nextPassword.length < 8) {
    res.status(400).json({ error: "weak-password" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resetResult = await client.query(
      "SELECT reset_token_hash, reset_token_expires_at FROM password_resets WHERE email = $1",
      [email]
    );
    const resetRow = resetResult.rows[0];
    const expectedResetTokenHash = String(resetRow?.reset_token_hash || "");
    const actualResetTokenHash = hashVerificationToken(resetToken);
    const validResetToken =
      Boolean(expectedResetTokenHash) &&
      isIsoDateInFuture(resetRow?.reset_token_expires_at) &&
      crypto.timingSafeEqual(Buffer.from(expectedResetTokenHash), Buffer.from(actualResetTokenHash));
    if (!validResetToken) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "reset-session-invalid" });
      return;
    }

    const passwordHash = createPasswordHash(nextPassword);
    const updatedUser = await client.query(
      `
        UPDATE users
        SET password_hash = $1, auth_token = NULL, auth_token_created_at = NULL
        WHERE email = $2
        RETURNING id
      `,
      [passwordHash, email]
    );
    if (!updatedUser.rows[0]) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "reset-session-invalid" });
      return;
    }

    await client.query("DELETE FROM password_resets WHERE email = $1", [email]);
    await client.query("COMMIT");
    clearSessionCookie(req, res);
    res.json({ ok: true });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "password-reset-complete-failed" });
  } finally {
    client.release();
  }
});

authRouter.post("/account/change-password", requireAuth, async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "account-change-password", maxAttempts: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const userId = Number(req.authUser?.id || 0);
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "invalid-password-input" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "weak-password" });
    return;
  }

  try {
    const result = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      res.status(401).json({ error: "invalid-current-password" });
      return;
    }
    if (verifyPassword(newPassword, user.password_hash)) {
      res.status(400).json({ error: "new-password-same-as-current" });
      return;
    }

    const nextPasswordHash = createPasswordHash(newPassword);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [nextPasswordHash, userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "password-change-failed" });
  }
});

authRouter.post("/account/logout-all", requireAuth, async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "account-logout-all", maxAttempts: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const userId = Number(req.authUser?.id || 0);
  try {
    await query("UPDATE users SET auth_token = NULL, auth_token_created_at = NULL WHERE id = $1", [userId]);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "logout-all-failed" });
  }
});

authRouter.get("/account", requireAuth, async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  try {
    const result = await query("SELECT username, email FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: "account-not-found" });
      return;
    }
    res.json({
      username: String(user.username || "").trim().toLowerCase(),
      email: String(user.email || "").trim().toLowerCase(),
    });
  } catch {
    res.status(500).json({ error: "account-query-failed" });
  }
});

authRouter.delete("/account", requireAuth, async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "account-delete", maxAttempts: 6, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const userId = Number(req.authUser?.id || 0);
  const password = String(req.body?.password || "");
  if (!password) {
    res.status(400).json({ error: "password-required" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT password_hash, email, plan, subscription_status FROM users WHERE id = $1",
      [userId]
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      await client.query("ROLLBACK");
      res.status(401).json({ error: "invalid-current-password" });
      return;
    }
    if (normalizePlan(user.plan) === "pro" && !isCanceledSubscriptionStatus(user.subscription_status)) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "pro-subscription-active" });
      return;
    }

    const userEmail = String(user.email || "").trim().toLowerCase();
    if (userEmail) {
      await client.query("DELETE FROM email_verifications WHERE email = $1", [userEmail]);
      await client.query("DELETE FROM password_resets WHERE email = $1", [userEmail]);
    }
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
    clearSessionCookie(req, res);
    res.json({ ok: true });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "account-delete-failed" });
  } finally {
    client.release();
  }
});

authRouter.post("/logout", async (req, res) => {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    clearSessionCookie(req, res);
    res.json({ ok: true });
    return;
  }

  try {
    await query("UPDATE users SET auth_token = NULL, auth_token_created_at = NULL WHERE auth_token = $1", [token]);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "logout-failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  if (!enforceRateLimit(req, res, { bucket: "login", maxAttempts: 20, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  try {
    const userResult = await query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username]
    );
    const user = userResult.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "invalid-credentials" });
      return;
    }

    const token = issueToken();
    const now = new Date().toISOString();

    await query("UPDATE users SET auth_token = $1, auth_token_created_at = $2 WHERE id = $3", [
      token,
      now,
      user.id,
    ]);
    await query(
      `
        INSERT INTO progress (user_id, total_xp, coins, streak_count, learned_words_json, updated_at)
        VALUES ($1, 0, 0, 1, '[]'::jsonb, $2)
        ON CONFLICT(user_id) DO NOTHING
      `,
      [user.id, now]
    );
    await query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, '{}'::jsonb, $2)
        ON CONFLICT(user_id) DO NOTHING
      `,
      [user.id, now]
    );
    await trackRetentionEvent(user.id, "login", { source: "auth/login" });
    await trackRetentionEvent(user.id, "session_start", { source: "auth/login" });

    setSessionCookie(req, res, token);
    res.json({ userId: Number(user.id), username: user.username, token });
  } catch {
    res.status(500).json({ error: "login-failed" });
  }
});
