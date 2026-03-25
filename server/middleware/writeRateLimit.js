export function createWriteRateLimitMiddleware({
  consumeWriteRateLimit,
  getRequesterKey,
  windowMs,
  maxAttempts,
}) {
  return async function enforceWriteRateLimit(req, res, next) {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }

    const routeScope = req.baseUrl || req.path || "/api";
    const key = `${routeScope}:${getRequesterKey(req)}`;
    try {
      const rateLimit = await consumeWriteRateLimit({
        key,
        windowMs,
        maxAttempts,
      });

      if (!rateLimit.isAllowed) {
        res.status(429).json({ error: "rate-limited", retryAfterSeconds: rateLimit.retryAfterSeconds });
        return;
      }
    } catch (error) {
      // Fail open so temporary DB issues do not block all writes.
      console.error("Write rate limiter unavailable", error);
    }

    next();
  };
}

