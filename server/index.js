import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { initDb } from "./db/client.js";
import { authRouter } from "./routes/auth.js";
import { wordsRouter } from "./routes/words.js";
import { progressRouter } from "./routes/progress.js";
import { stateRouter } from "./routes/state.js";
import { examplesRouter } from "./routes/examples.js";
import { socialRouter } from "./routes/social.js";
import { billingRouter, billingWebhookRouter } from "./routes/billing.js";

dotenv.config({ path: "server/.env" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8000);
const host = "0.0.0.0";

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const envAllowedOrigins = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

function getRequesterKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwardedFor || req.ip || "unknown";
}

const writeRateLimitBuckets = new Map();
const WRITE_RATE_LIMIT_WINDOW_MS = Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const WRITE_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.WRITE_RATE_LIMIT_MAX_ATTEMPTS || 180);

function enforceWriteRateLimit(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const routeScope = req.baseUrl || req.path || "/api";
  const key = `${routeScope}:${getRequesterKey(req)}`;
  const now = Date.now();
  const current = writeRateLimitBuckets.get(key) || [];
  const recent = current.filter((timestamp) => now - timestamp < WRITE_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= WRITE_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((WRITE_RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000)
    );
    res.status(429).json({ error: "rate-limited", retryAfterSeconds });
    return;
  }

  recent.push(now);
  writeRateLimitBuckets.set(key, recent);
  next();
}

app.disable("x-powered-by");
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
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use("/api/billing/webhook", billingWebhookRouter);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "my-vocab-app-api",
    now: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/words", wordsRouter);
app.use("/api/progress", enforceWriteRateLimit, progressRouter);
app.use("/api/state", enforceWriteRateLimit, stateRouter);
app.use("/api/examples", examplesRouter);
app.use("/api/social", enforceWriteRateLimit, socialRouter);
app.use("/api/billing", enforceWriteRateLimit, billingRouter);

initDb()
  .then(() => {
    app.listen(port, host, () => {
      console.log(`API listening on http://${host}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
