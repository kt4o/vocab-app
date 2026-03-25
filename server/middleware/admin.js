import crypto from "node:crypto";

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function requireAdminKey(req, res, next) {
  const configuredKey = String(process.env.ADMIN_API_KEY || "").trim();
  if (!configuredKey) {
    res.status(503).json({ error: "admin-not-configured" });
    return;
  }

  const providedKey = String(req.headers["x-admin-key"] || "").trim();
  if (!providedKey) {
    res.status(401).json({ error: "missing-admin-key" });
    return;
  }

  if (!timingSafeEqualText(providedKey, configuredKey)) {
    res.status(403).json({ error: "invalid-admin-key" });
    return;
  }

  next();
}
