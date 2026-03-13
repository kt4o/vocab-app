import crypto from "node:crypto";
import { Router } from "express";
import { pool, query } from "../db/client.js";
import { sendPasswordResetCodeEmail, sendVerificationCodeEmail } from "../lib/email.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const authRateBuckets = new Map();
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000;

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

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid-email" });
    return;
  }
  if (!isValidUsername(username)) {
    res.status(400).json({ error: "invalid-username" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "weak-password" });
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
        INSERT INTO users (username, email, password_hash, created_at, auth_token, auth_token_created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [username, email, passwordHash, now, token, now]
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
    res.json({ ok: true });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "account-delete-failed" });
  } finally {
    client.release();
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

    res.json({ userId: Number(user.id), username: user.username, token });
  } catch {
    res.status(500).json({ error: "login-failed" });
  }
});
