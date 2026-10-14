#!/usr/bin/env tsx
/**
 * B3-04: Create the single Admin from BOOTSTRAP_ADMIN_* env vars.
 * Refuses a second run (exits non-zero) when an admin already exists.
 */
import "dotenv/config";
import { Pool } from "pg";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/server/security/password.js";

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("[bootstrap-admin] Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD.");
    process.exit(1);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(
      `[bootstrap-admin] BOOTSTRAP_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[bootstrap-admin] Set DATABASE_URL_DIRECT (or DATABASE_URL).");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  try {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    if (existing.rows[0]) {
      console.error("[bootstrap-admin] An Admin user already exists — refusing second run.");
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);
    const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || username;

    await pool.query(
      `INSERT INTO users (username, password_hash, role, display_name, must_change_password)
       VALUES ($1, $2, 'admin'::user_role, $3, true)`,
      [username, passwordHash, displayName],
    );

    // Do not echo env-derived username (CodeQL js/clear-text-logging).
    console.log("[bootstrap-admin] Created Admin user.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[bootstrap-admin] FAILED:", err);
  process.exit(1);
});
