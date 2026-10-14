#!/usr/bin/env tsx
/**
 * B1-17 / B4-09: Idempotent synthetic seed — 1 admin, 2 builders, 2 viewers,
 * plus Standard / Courier flows via the flows service layer. Dev/test only;
 * no real data.
 *
 * Password for every seeded user: ChangeMe!dev-only
 */
import "dotenv/config";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { generateRequestId } from "../src/server/kernel/request-id.js";
import { resetDbClient } from "../src/server/db/client.js";
import { resetEnvCache } from "../src/server/env.js";
import { seedStandardAndCourierFlows } from "../src/server/flows/seed-flows.js";
import type { RequestContext } from "../src/server/db/with-user.js";

const DEV_PASSWORD = "ChangeMe!dev-only";

/** Fill gaps so getEnv()/getDb() can boot for service-layer seeding. */
function ensureSeedEnv(connectionString: string): void {
  process.env.DATABASE_URL ??= connectionString;
  process.env.DATABASE_URL_DIRECT ??= connectionString;
  process.env.SESSION_SECRET ??= "seed-dev-only-session-secret-32chars!";
  process.env.ENCRYPTION_KEY ??= "seed-dev-only-encryption-key-32chars!";
  process.env.STORAGE_PROVIDER ??= "local";
  process.env.FILE_STORAGE_DIR ??= "/tmp/chopda-seed-storage";
  process.env.CRON_SECRET ??= "seed-dev-only-cron-secret";
  resetEnvCache();
}

/** Rename legacy B1 raw-SQL Standard/Courier when they are not the B4 5-step shape. */
async function retireLegacyFlowIfWrongShape(pool: Pool, name: string): Promise<void> {
  const result = await pool.query<{ id: string; n: number }>(
    `SELECT ft.id, coalesce(count(fs.id), 0)::int AS n
     FROM flow_templates ft
     LEFT JOIN flow_versions fv
       ON fv.template_id = ft.id AND fv.published_at IS NOT NULL
     LEFT JOIN flow_steps fs ON fs.version_id = fv.id
     WHERE ft.name = $1
     GROUP BY ft.id`,
    [name],
  );
  const row = result.rows[0];
  if (!row) return;
  if (row.n === 5) return;
  await pool.query(`UPDATE flow_templates SET name = $1, updated_at = now() WHERE id = $2`, [
    `${name} (legacy ${Date.now()})`,
    row.id,
  ]);
}

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
  ensureSeedEnv(connectionString);

  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
  const pool = new Pool({ connectionString });

  let adminId: string;
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
    adminId = admin.rows[0]?.id ?? "";
    if (!adminId) {
      throw new Error("Seed admin user missing after upsert.");
    }

    // Retire pre-B4 raw fixtures so service-layer Standard/Courier can be created.
    await retireLegacyFlowIfWrongShape(pool, "Standard");
    await retireLegacyFlowIfWrongShape(pool, "Courier");

    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  } finally {
    await pool.end();
  }

  await resetDbClient();

  const ctx: RequestContext = {
    userId: adminId,
    role: "admin",
    requestId: generateRequestId(),
  };

  const { standardId, courierId } = await seedStandardAndCourierFlows(ctx);
  console.log(
    `[seed] idempotent seed complete (users + Standard=${standardId.slice(0, 8)}… Courier=${courierId.slice(0, 8)}…).`,
  );

  await resetDbClient();
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
