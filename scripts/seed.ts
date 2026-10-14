#!/usr/bin/env tsx
/**
 * B1-17: Idempotent synthetic seed — 1 admin, 2 builders, 2 viewers, plus
 * raw Standard / Courier flow fixtures (service-layer seed lands in B4-09).
 * Dev/test only; no real data.
 *
 * Password for every seeded user: ChangeMe!dev-only
 */
import "dotenv/config";
import * as argon2 from "argon2";
import { Pool } from "pg";

const DEV_PASSWORD = "ChangeMe!dev-only";

const USERS = [
  { username: "admin", role: "admin", displayName: "Seed Admin" },
  { username: "builder1", role: "builder", displayName: "Seed Builder One" },
  { username: "builder2", role: "builder", displayName: "Seed Builder Two" },
  { username: "viewer1", role: "viewer", displayName: "Seed Viewer One" },
  { username: "viewer2", role: "viewer", displayName: "Seed Viewer Two" },
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL_DIRECT (or DATABASE_URL) before seeding.");
  }

  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
  const pool = new Pool({ connectionString });

  try {
    await pool.query("BEGIN");

    for (const u of USERS) {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, display_name, must_change_password)
         VALUES ($1, $2, $3::user_role, $4, true)
         ON CONFLICT (username) DO NOTHING`,
        [u.username, passwordHash, u.role, u.displayName],
      );
    }

    const admin = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE username = 'admin' LIMIT 1`,
    );
    const adminId = admin.rows[0]?.id;
    if (!adminId) {
      throw new Error("Seed admin missing after insert");
    }

    // Raw Standard flow (4 steps) — B4-09 will replace via service layer.
    const existing = await pool.query(
      `SELECT 1 FROM flow_templates WHERE name = 'Standard' LIMIT 1`,
    );
    if (existing.rowCount === 0) {
      const tmpl = await pool.query<{ id: string }>(
        `INSERT INTO flow_templates (name, status, created_by)
         VALUES ('Standard', 'published', $1)
         RETURNING id`,
        [adminId],
      );
      const templateId = tmpl.rows[0]!.id;
      const ver = await pool.query<{ id: string }>(
        `INSERT INTO flow_versions (template_id, version_no, published_at)
         VALUES ($1, 1, now())
         RETURNING id`,
        [templateId],
      );
      const versionId = ver.rows[0]!.id;
      const steps = [
        ["Receive", "builder"],
        ["Validate", "builder"],
        ["Deliver", "builder"],
        ["Confirm payment", "admin"],
      ] as const;
      for (let i = 0; i < steps.length; i++) {
        const [name, role] = steps[i]!;
        await pool.query(
          `INSERT INTO flow_steps (version_id, position, name, instructions, allowed_role, fields)
           VALUES ($1, $2, $3, $4, $5::user_role, '[]'::jsonb)`,
          [versionId, i + 1, name, `${name} step`, role],
        );
      }
    }

    const courier = await pool.query(`SELECT 1 FROM flow_templates WHERE name = 'Courier' LIMIT 1`);
    if (courier.rowCount === 0) {
      const tmpl = await pool.query<{ id: string }>(
        `INSERT INTO flow_templates (name, status, created_by)
         VALUES ('Courier', 'published', $1)
         RETURNING id`,
        [adminId],
      );
      const templateId = tmpl.rows[0]!.id;
      const ver = await pool.query<{ id: string }>(
        `INSERT INTO flow_versions (template_id, version_no, published_at)
         VALUES ($1, 1, now())
         RETURNING id`,
        [templateId],
      );
      const versionId = ver.rows[0]!.id;
      const steps = [
        ["Receive", "builder"],
        ["Validate", "builder"],
        ["Deliver", "builder"],
        ["Courier handoff", "builder"],
        ["Confirm payment", "admin"],
      ] as const;
      for (let i = 0; i < steps.length; i++) {
        const [name, role] = steps[i]!;
        await pool.query(
          `INSERT INTO flow_steps (version_id, position, name, instructions, allowed_role, fields)
           VALUES ($1, $2, $3, $4, $5::user_role, '[]'::jsonb)`,
          [versionId, i + 1, name, `${name} step`, role],
        );
      }
    }

    await pool.query("COMMIT");
    console.log("[seed] OK — users + Standard/Courier raw fixtures (password: ChangeMe!dev-only)");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
