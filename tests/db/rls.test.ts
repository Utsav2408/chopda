import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool, PoolClient } from "pg";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown, withClient } from "./harness.js";

const connectionString = resolveTestDatabaseUrl();

async function insertUser(client: PoolClient, opts: { username: string; role: string }) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users (username, password_hash, role, display_name)
     VALUES ($1, 'x', $2::user_role, $3)
     RETURNING id`,
    [opts.username, opts.role, opts.username],
  );
  return result.rows[0]!.id;
}

async function asAppUser(
  client: PoolClient,
  opts: { userId: string; role: string },
  fn: () => Promise<void>,
) {
  await client.query("SET LOCAL ROLE app_user");
  await client.query(`SELECT set_config('app.user_id', $1, true)`, [opts.userId]);
  await client.query(`SELECT set_config('app.role', $1, true)`, [opts.role]);
  await fn();
}

async function expectQueryFails(
  client: PoolClient,
  sql: string,
  params: unknown[],
  pattern?: RegExp,
) {
  await client.query("SAVEPOINT expect_fail");
  let err: unknown;
  try {
    await client.query(sql, params);
  } catch (e) {
    err = e;
  }
  await client.query("ROLLBACK TO SAVEPOINT expect_fail");
  await client.query("RELEASE SAVEPOINT expect_fail");
  expect(err, `expected query to fail: ${sql}`).toBeTruthy();
  if (pattern) {
    expect(String(err)).toMatch(pattern);
  }
}

describe.skipIf(!connectionString)("B1 RLS smoke", () => {
  let pool: Pool;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    pool = await setupTestDatabase(connectionString);
  });

  afterAll(async () => {
    await teardown(pool);
  });

  it("viewer cannot insert flow_templates; builder can", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        const viewerId = await insertUser(client, {
          username: `rls_viewer_${suffix}`,
          role: "viewer",
        });
        const builderId = await insertUser(client, {
          username: `rls_builder_${suffix}`,
          role: "builder",
        });

        await asAppUser(client, { userId: viewerId, role: "viewer" }, async () => {
          await expectQueryFails(
            client,
            `INSERT INTO flow_templates (name, status, created_by)
             VALUES ($1, 'draft', $2)`,
            [`rls_denied_${suffix}`, viewerId],
          );
        });

        await client.query("RESET ROLE");

        await asAppUser(client, { userId: builderId, role: "builder" }, async () => {
          const inserted = await client.query(
            `INSERT INTO flow_templates (name, status, created_by)
             VALUES ($1, 'draft', $2) RETURNING id`,
            [`rls_ok_${suffix}`, builderId],
          );
          expect(inserted.rows[0]).toBeTruthy();
        });
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("viewer cannot select company_bank_accounts; builder can", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO company_bank_accounts (
             label, bank_name, account_holder, account_number_encrypted, ifsc_encrypted,
             is_default, is_active
           ) VALUES ('RLS Bank', 'Test', 'Co', 'enc', 'enc', true, true)`,
        );

        const viewerId = await insertUser(client, {
          username: `rls_bank_v_${suffix}`,
          role: "viewer",
        });
        const builderId = await insertUser(client, {
          username: `rls_bank_b_${suffix}`,
          role: "builder",
        });

        await asAppUser(client, { userId: viewerId, role: "viewer" }, async () => {
          const rows = await client.query(`SELECT id FROM company_bank_accounts`);
          expect(rows.rowCount).toBe(0);
        });

        await client.query("RESET ROLE");

        await asAppUser(client, { userId: builderId, role: "builder" }, async () => {
          const rows = await client.query(`SELECT id FROM company_bank_accounts`);
          expect(rows.rowCount).toBeGreaterThan(0);
        });
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("audit_log select: unrelated rows admin-only; invoice-tied rows gated by B7 policy", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        const actorId = await insertUser(client, {
          username: `rls_audit_a_${suffix}`,
          role: "builder",
        });
        await client.query(
          `INSERT INTO audit_log (actor_id, action, entity, entity_id)
           VALUES ($1, 'rls', 'test', '1')`,
          [actorId],
        );

        const viewerId = await insertUser(client, {
          username: `rls_audit_v_${suffix}`,
          role: "viewer",
        });

        await asAppUser(client, { userId: viewerId, role: "viewer" }, async () => {
          const rows = await client.query(`SELECT id FROM audit_log`);
          expect(rows.rowCount).toBe(0);
        });

        await client.query("RESET ROLE");

        await asAppUser(client, { userId: actorId, role: "admin" }, async () => {
          const rows = await client.query(`SELECT id FROM audit_log`);
          expect(rows.rowCount).toBeGreaterThan(0);
        });
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });
});
