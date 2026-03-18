import { query } from "../db/client.js";

const SESSION_COOKIE_NAME = String(process.env.AUTH_COOKIE_NAME || "vocab_session").trim() || "vocab_session";

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
    const result = await query("SELECT id, username, plan FROM users WHERE auth_token = $1", [token]);
    user = result.rows[0] || null;
  } catch {
    res.status(500).json({ error: "auth-query-failed" });
    return;
  }

  if (!user) {
    res.status(401).json({ error: "invalid-auth-token" });
    return;
  }

  req.authUser = user;
  req.authToken = token;
  next();
}
