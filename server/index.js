import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, initDb, query } from "./db/client.js";
import { authRouter } from "./routes/auth.js";
import { wordsRouter } from "./routes/words.js";
import { progressRouter } from "./routes/progress.js";
import { stateRouter } from "./routes/state.js";
import { socialRouter } from "./routes/social.js";
import { analyticsRouter } from "./routes/analytics.js";
import { billingRouter, billingWebhookRouter } from "./routes/billing.js";
import { consumeWriteRateLimit } from "./lib/rateLimit.js";

dotenv.config({ path: "server/.env" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const host = "0.0.0.0";
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const allowLocalhostInProduction =
  String(process.env.ALLOW_LOCALHOST_IN_PRODUCTION || "").trim().toLowerCase() === "true";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const distIndexPath = path.join(distDir, "index.html");

function parseCsvEnv(value, { toUpper = false } = {}) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (toUpper ? entry.toUpperCase() : entry));
}

function isLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || "").trim());
}

const defaultAllowedOrigins = isProduction && !allowLocalhostInProduction
  ? []
  : [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
const envAllowedOrigins = parseCsvEnv(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "");
const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

if (isProduction && !allowLocalhostInProduction) {
  if (!envAllowedOrigins.length) {
    throw new Error(
      "CORS_ORIGIN or CORS_ORIGINS is required in production. Refusing localhost-only CORS config."
    );
  }

  const hasLocalhostOrigin = Array.from(allowedOrigins).some((origin) => isLocalhostOrigin(origin));
  if (hasLocalhostOrigin) {
    throw new Error(
      "Localhost origins are not allowed in production. Set ALLOW_LOCALHOST_IN_PRODUCTION=true to override intentionally."
    );
  }
}

const allowedCountries = new Set(parseCsvEnv(process.env.ALLOWED_COUNTRIES, { toUpper: true }));
const blockedCountries = new Set(parseCsvEnv(process.env.BLOCKED_COUNTRIES, { toUpper: true }));

function getRequesterCountry(req) {
  const candidates = [
    req.headers["cf-ipcountry"],
    req.headers["x-vercel-ip-country"],
    req.headers["cloudfront-viewer-country"],
    req.headers["x-country-code"],
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "")
      .trim()
      .toUpperCase();
    if (/^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") {
      return value;
    }
  }
  return "";
}

function getRequesterKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwardedFor || req.ip || "unknown";
}

function getSafePositiveInt(value, fallbackValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackValue;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : fallbackValue;
}

const WRITE_RATE_LIMIT_WINDOW_MS = getSafePositiveInt(
  process.env.WRITE_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const WRITE_RATE_LIMIT_MAX_ATTEMPTS = getSafePositiveInt(
  process.env.WRITE_RATE_LIMIT_MAX_ATTEMPTS,
  180
);
const READINESS_DB_TIMEOUT_MS = getSafePositiveInt(process.env.READINESS_DB_TIMEOUT_MS, 1500);

async function enforceWriteRateLimit(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const routeScope = req.baseUrl || req.path || "/api";
  const key = `${routeScope}:${getRequesterKey(req)}`;
  try {
    const rateLimit = await consumeWriteRateLimit({
      key,
      windowMs: WRITE_RATE_LIMIT_WINDOW_MS,
      maxAttempts: WRITE_RATE_LIMIT_MAX_ATTEMPTS,
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
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
});
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use((req, res, next) => {
  if (req.path === "/api/health") {
    next();
    return;
  }

  const requesterCountry = getRequesterCountry(req);
  if (requesterCountry) {
    res.setHeader("X-App-Requester-Country", requesterCountry);
  }

  if (blockedCountries.size > 0 && requesterCountry && blockedCountries.has(requesterCountry)) {
    res.status(451).json({ error: "country-not-supported", country: requesterCountry });
    return;
  }

  if (allowedCountries.size > 0) {
    if (!requesterCountry || !allowedCountries.has(requesterCountry)) {
      res.status(451).json({ error: "country-not-supported", country: requesterCountry || null });
      return;
    }
  }

  next();
});

app.use("/api/billing/webhook", billingWebhookRouter);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "my-vocab-app-api",
    now: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get("/api/ready", async (_req, res) => {
  try {
    await Promise.race([
      query("SELECT 1"),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database readiness timeout")), READINESS_DB_TIMEOUT_MS);
      }),
    ]);
    res.json({
      ok: true,
      service: "my-vocab-app-api",
      now: new Date().toISOString(),
      db: "up",
    });
  } catch (error) {
    console.error("Readiness check failed", error);
    res.status(503).json({
      ok: false,
      service: "my-vocab-app-api",
      now: new Date().toISOString(),
      db: "down",
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/words", wordsRouter);
app.use("/api/progress", enforceWriteRateLimit, progressRouter);
app.use("/api/state", enforceWriteRateLimit, stateRouter);
app.use("/api/social", enforceWriteRateLimit, socialRouter);
app.use("/api/analytics", enforceWriteRateLimit, analyticsRouter);
app.use("/api/billing", enforceWriteRateLimit, billingRouter);

if (fs.existsSync(distIndexPath)) {
  app.use(express.static(distDir));

  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(distIndexPath);
  });
}

let serverInstance = null;
let shutdownInProgress = false;

function closeHttpServer() {
  return new Promise((resolve, reject) => {
    if (!serverInstance) {
      resolve();
      return;
    }

    const closeTimer = setTimeout(() => {
      reject(new Error("Timed out while closing HTTP server"));
    }, 10_000);

    serverInstance.close((error) => {
      clearTimeout(closeTimer);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function shutdown(signalName, exitCode = 0) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  console.log(`Received ${signalName}. Shutting down API...`);

  try {
    await closeHttpServer();
  } catch (error) {
    console.error("Failed to close HTTP server cleanly", error);
  }

  try {
    await closeDb();
  } catch (error) {
    console.error("Failed to close database pool cleanly", error);
  }

  process.exit(exitCode);
}

["SIGINT", "SIGTERM"].forEach((signalName) => {
  process.on(signalName, () => {
    void shutdown(signalName, 0);
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  void shutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);
  void shutdown("unhandledRejection", 1);
});

initDb()
  .then(() => {
    serverInstance = app.listen(port, host, () => {
      console.log(`API listening on http://${host}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
