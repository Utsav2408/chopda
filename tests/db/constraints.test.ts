import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool, PoolClient } from "pg";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown, withClient } from "./harness.js";

const connectionString = resolveTestDatabaseUrl();

async function insertUser(
  client: PoolClient,
  opts: { username: string; role: string; displayName?: string },
) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users (username, password_hash, role, display_name)
     VALUES ($1, 'x', $2::user_role, $3)
     RETURNING id`,
    [opts.username, opts.role, opts.displayName ?? opts.username],
  );
  return result.rows[0]!.id;
}

/** Expect a query to fail without aborting the surrounding transaction. */
async function expectQueryFails(
  client: PoolClient,
  sql: string,
  params: unknown[],
  pattern: RegExp,
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
  expect(String(err)).toMatch(pattern);
}

describe.skipIf(!connectionString)("B1 DB constraints", () => {
  let pool: Pool;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    pool = await setupTestDatabase(connectionString);
  });

  afterAll(async () => {
    await teardown(pool);
  });

  it("one_admin: second admin insert fails", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        const existing = await client.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM users WHERE role = 'admin'`,
        );
        const adminCount = Number(existing.rows[0]?.n ?? 0);

        if (adminCount === 0) {
          await insertUser(client, { username: `admin_a_${suffix}`, role: "admin" });
        }

        await expectQueryFails(
          client,
          `INSERT INTO users (username, password_hash, role, display_name)
           VALUES ($1, 'x', 'admin', $2)`,
          [`admin_b_${suffix}`, `Admin B ${suffix}`],
          /one_admin|unique/i,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("published flow_steps are immutable", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        const userId = await insertUser(client, {
          username: `pub_user_${suffix}`,
          role: "builder",
        });
        const tmpl = await client.query<{ id: string }>(
          `INSERT INTO flow_templates (name, status, created_by)
           VALUES ($1, 'published', $2) RETURNING id`,
          [`pub_flow_${suffix}`, userId],
        );
        const ver = await client.query<{ id: string }>(
          `INSERT INTO flow_versions (template_id, version_no, published_at)
           VALUES ($1, 1, now()) RETURNING id`,
          [tmpl.rows[0]!.id],
        );
        const step = await client.query<{ id: string }>(
          `INSERT INTO flow_steps (version_id, position, name, allowed_role, fields)
           VALUES ($1, 0, 'Step A', 'builder', '[]'::jsonb) RETURNING id`,
          [ver.rows[0]!.id],
        );

        await expectQueryFails(
          client,
          `UPDATE flow_steps SET name = 'Nope' WHERE id = $1`,
          [step.rows[0]!.id],
          /published/i,
        );
        await expectQueryFails(
          client,
          `DELETE FROM flow_steps WHERE id = $1`,
          [step.rows[0]!.id],
          /published/i,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("invoice_steps enforce order and forward-only status", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        const userId = await insertUser(client, {
          username: `inv_user_${suffix}`,
          role: "builder",
        });
        const tmpl = await client.query<{ id: string }>(
          `INSERT INTO flow_templates (name, status, created_by)
           VALUES ($1, 'draft', $2) RETURNING id`,
          [`inv_flow_${suffix}`, userId],
        );
        const ver = await client.query<{ id: string }>(
          `INSERT INTO flow_versions (template_id, version_no)
           VALUES ($1, 1) RETURNING id`,
          [tmpl.rows[0]!.id],
        );
        const s0 = await client.query<{ id: string }>(
          `INSERT INTO flow_steps (version_id, position, name, allowed_role)
           VALUES ($1, 0, 'First', 'builder') RETURNING id`,
          [ver.rows[0]!.id],
        );
        const s1 = await client.query<{ id: string }>(
          `INSERT INTO flow_steps (version_id, position, name, allowed_role)
           VALUES ($1, 1, 'Second', 'builder') RETURNING id`,
          [ver.rows[0]!.id],
        );
        const inv = await client.query<{ id: string }>(
          `INSERT INTO invoices (
             invoice_no, flow_version_id, party_name, amount_minor,
             issue_date, owner_id, created_by
           ) VALUES ($1, $2, 'Acme', 100, CURRENT_DATE, $3, $3)
           RETURNING id`,
          [`INV-${suffix}`, ver.rows[0]!.id, userId],
        );
        const invoiceId = inv.rows[0]!.id;

        const ist0 = await client.query<{ id: string }>(
          `INSERT INTO invoice_steps (invoice_id, flow_step_id, status)
           VALUES ($1, $2, 'open') RETURNING id`,
          [invoiceId, s0.rows[0]!.id],
        );
        const ist1 = await client.query<{ id: string }>(
          `INSERT INTO invoice_steps (invoice_id, flow_step_id, status)
           VALUES ($1, $2, 'open') RETURNING id`,
          [invoiceId, s1.rows[0]!.id],
        );

        await expectQueryFails(
          client,
          `UPDATE invoice_steps SET status = 'completed', completed_by = $2, completed_at = now()
           WHERE id = $1`,
          [ist1.rows[0]!.id, userId],
          /in order/i,
        );

        await client.query(
          `UPDATE invoice_steps SET status = 'completed', completed_by = $2, completed_at = now()
           WHERE id = $1`,
          [ist0.rows[0]!.id, userId],
        );
        await client.query(
          `UPDATE invoice_steps SET status = 'completed', completed_by = $2, completed_at = now()
           WHERE id = $1`,
          [ist1.rows[0]!.id, userId],
        );

        await expectQueryFails(
          client,
          `UPDATE invoice_steps SET status = 'open' WHERE id = $1`,
          [ist0.rows[0]!.id],
          /forward-only/i,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("company_profile singleton and one active default bank", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO company_profile (id, legal_name)
           VALUES (1, 'Seed Co')
           ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name`,
        );

        await expectQueryFails(
          client,
          `INSERT INTO company_profile (id, legal_name) VALUES (2, 'Other')`,
          [],
          /company_profile_singleton|check/i,
        );

        await client.query(
          `INSERT INTO company_bank_accounts (
             label, bank_name, account_holder, account_number_encrypted, ifsc_encrypted,
             is_default, is_active
           ) VALUES ('Primary', 'Test Bank', 'Seed Co', 'enc-acct', 'enc-ifsc', true, true)`,
        );

        await expectQueryFails(
          client,
          `INSERT INTO company_bank_accounts (
             label, bank_name, account_holder, account_number_encrypted, ifsc_encrypted,
             is_default, is_active
           ) VALUES ('Second', 'Test Bank', 'Seed Co', 'enc-acct-2', 'enc-ifsc-2', true, true)`,
          [],
          /one_default_active_bank|unique/i,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("documents has no bytea column", async () => {
    await withClient(pool, async (client) => {
      const result = await client.query<{ data_type: string }>(
        `SELECT data_type
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'documents'`,
      );
      const types = result.rows.map((r) => r.data_type);
      expect(types).not.toContain("bytea");
      expect(types.length).toBeGreaterThan(0);
    });
  });

  it("app_user cannot UPDATE or DELETE audit_log", async () => {
    await withClient(pool, async (client) => {
      await client.query("BEGIN");
      try {
        const userId = await insertUser(client, {
          username: `audit_user_${suffix}`,
          role: "builder",
        });
        const row = await client.query<{ id: string }>(
          `INSERT INTO audit_log (actor_id, action, entity, entity_id)
           VALUES ($1, 'test', 'users', $2) RETURNING id`,
          [userId, userId],
        );

        await client.query("SET LOCAL ROLE app_user");
        await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
        await client.query(`SELECT set_config('app.role', 'admin', true)`);

        await expectQueryFails(
          client,
          `UPDATE audit_log SET action = 'hacked' WHERE id = $1`,
          [row.rows[0]!.id],
          /permission denied|violates/i,
        );
        await expectQueryFails(
          client,
          `DELETE FROM audit_log WHERE id = $1`,
          [row.rows[0]!.id],
          /permission denied|violates/i,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });
});
