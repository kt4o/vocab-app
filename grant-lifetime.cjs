const dotenv = require("dotenv");
const path = require("node:path");
const { Pool } = require("pg");

dotenv.config({ path: path.resolve("server/.env") });
dotenv.config();

async function main() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing");
  }

  const useSsl = String(process.env.PGSSLMODE || "").toLowerCase() !== "disable";
  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  const username = "keitadev";

  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lifetime_pro BOOLEAN NOT NULL DEFAULT FALSE
    `);

    const result = await pool.query(
      `
        UPDATE users
        SET lifetime_pro = TRUE, plan = 'pro'
        WHERE username = $1
        RETURNING id, username, plan, lifetime_pro, subscription_status
      `,
      [username]
    );

    if (!result.rows.length) {
      console.log("User not found:", username);
      return;
    }

    const user = result.rows[0];
    console.log("Updated:", {
      id: user.id,
      username: user.username,
      plan: user.plan,
      lifetime_pro: user.lifetime_pro,
      subscription_status: user.subscription_status,
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to grant lifetime Pro:", error.message);
  process.exit(1);
});
