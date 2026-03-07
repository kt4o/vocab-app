import { Router } from "express";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

export const stateRouter = Router();

stateRouter.use(requireAuth);

stateRouter.get("/", async (req, res) => {
  const userId = req.authUser.id;

  try {
    const result = await query("SELECT state_json, updated_at FROM app_state WHERE user_id = $1", [
      userId,
    ]);
    const row = result.rows[0];

    const appState =
      row?.state_json && typeof row.state_json === "object" && !Array.isArray(row.state_json)
        ? row.state_json
        : null;

    res.json({
      userId,
      username: req.authUser.username,
      appState,
      updatedAt: row?.updated_at || null,
    });
  } catch {
    res.status(500).json({ error: "state-query-failed" });
  }
});

stateRouter.put("/", async (req, res) => {
  const userId = req.authUser.id;
  const appState = req.body?.appState;
  const now = new Date().toISOString();

  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    res.status(400).json({ error: "invalid-app-state" });
    return;
  }

  try {
    await query(
      `
        INSERT INTO app_state (user_id, state_json, updated_at)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(user_id) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `,
      [userId, JSON.stringify(appState), now]
    );

    res.json({
      userId,
      username: req.authUser.username,
      updatedAt: now,
    });
  } catch {
    res.status(500).json({ error: "state-update-failed" });
  }
});
