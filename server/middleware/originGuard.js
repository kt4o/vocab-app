function hasSessionCookie(req, sessionCookieName) {
  const cookieHeader = String(req.headers.cookie || "");
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${sessionCookieName}=`));
}

function getRequestOrigin(req) {
  const originHeader = String(req.headers.origin || "").trim();
  if (originHeader) return originHeader;

  const refererHeader = String(req.headers.referer || "").trim();
  if (!refererHeader) return "";

  try {
    return new URL(refererHeader).origin;
  } catch {
    return "";
  }
}

export function createCookieOriginGuard({ allowedOrigins, sessionCookieName }) {
  return function cookieOriginGuard(req, res, next) {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }

    if (!hasSessionCookie(req, sessionCookieName)) {
      next();
      return;
    }

    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
      res.status(403).json({ error: "invalid-origin" });
      return;
    }

    next();
  };
}

