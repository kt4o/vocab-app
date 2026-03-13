import { query } from "../db/client.js";

function getBearerToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

export async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
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
