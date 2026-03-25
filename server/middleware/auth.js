import { query } from "../db/client.js";

const SESSION_COOKIE_NAME = String(process.env.AUTH_COOKIE_NAME || "vocab_session").trim() || "vocab_session";
const AUTH_TOKEN_MAX_AGE_DAYS = (() => {
  const parsed = Number(process.env.AUTH_TOKEN_MAX_AGE_DAYS);
  if (!Number.isFinite(parsed)) return 30;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : 30;
})();
const AUTH_TOKEN_MAX_AGE_MS = AUTH_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || "");
  if (!cookieHeader) return {};
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const equalsIndex = pair.indexOf("=");
      if (equalsIndex <= 0) return acc;
      const key = pair.slice(0, equalsIndex).trim();
      const value = pair.slice(equalsIndex + 1).trim();
      if (!key) return acc;
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function getBearerToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function getCookieToken(req) {
  const cookies = parseCookies(req);
  return String(cookies[SESSION_COOKIE_NAME] || "").trim();
}

export function getAuthTokenFromRequest(req) {
  const bearerToken = getBearerToken(req);
  if (bearerToken) return bearerToken;
  return getCookieToken(req);
}

export async function requireAuth(req, res, next) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "missing-auth-token" });
    return;
  }

  let user = null;
  try {
    const result = await query("SELECT id, username, plan, auth_token_created_at FROM users WHERE auth_token = $1", [
      token,
    ]);
    user = result.rows[0] || null;
  } catch {
    res.status(500).json({ error: "auth-query-failed" });
    return;
  }

  if (!user) {
    res.status(401).json({ error: "invalid-auth-token" });
    return;
  }

  const tokenCreatedAtMs = Date.parse(user.auth_token_created_at);
  const tokenAgeMs = Date.now() - tokenCreatedAtMs;
  if (!Number.isFinite(tokenCreatedAtMs) || tokenAgeMs > AUTH_TOKEN_MAX_AGE_MS) {
    // Best-effort cleanup: clear stale token so future requests fail fast.
    try {
      await query("UPDATE users SET auth_token = NULL, auth_token_created_at = NULL WHERE id = $1 AND auth_token = $2", [
        user.id,
        token,
      ]);
    } catch {
      // Ignore cleanup failures and still deny the request.
    }
    res.status(401).json({ error: "expired-auth-token" });
    return;
  }

  req.authUser = { id: user.id, username: user.username, plan: user.plan };
  req.authToken = token;
  next();
}
