import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { initDb } from "./db/client.js";
import { authRouter } from "./routes/auth.js";
import { wordsRouter } from "./routes/words.js";
import { progressRouter } from "./routes/progress.js";
import { stateRouter } from "./routes/state.js";

dotenv.config({ path: "server/.env" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8000);
const host = "0.0.0.0";

app.use(cors());
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
app.use("/api/progress", progressRouter);
app.use("/api/state", stateRouter);

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
