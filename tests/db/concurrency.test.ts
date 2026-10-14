/**
 * B9-04 concurrency sketches.
 *
 * - Double step-complete: conditional UPDATE … WHERE status='open' → one winner.
 * - transferAdmin race: one_admin unique index → one winner.
 *
 * Skips when no TEST_DATABASE_URL / DATABASE_URL is available.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { eq } from "drizzle-orm";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown } from "./harness.js";
import { resetDbClient, getDb } from "../../src/server/db/client.js";
import { resetEnvCache } from "../../src/server/env.js";
import { invoiceSteps, users } from "../../src/server/db/schema.js";
import type { RequestContext } from "../../src/server/db/with-user.js";
import { Conflict } from "../../src/server/kernel/errors.js";
import * as flows from "../../src/server/flows/service.js";
import * as invoices from "../../src/server/invoices/service.js";
import * as steps from "../../src/server/steps/service.js";
import * as usersService from "../../src/server/users/service.js";

const connectionString = resolveTestDatabaseUrl();

function ensureTestEnv(url: string): void {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_URL_DIRECT = url;
  process.env.SESSION_SECRET ??= "test-session-secret-32-characters!!";
  process.env.ENCRYPTION_KEY ??= "test-encryption-key-32-characters!!";
  process.env.STORAGE_PROVIDER ??= "local";
  process.env.FILE_STORAGE_DIR ??= "/tmp/chopda-test-storage";
  process.env.CRON_SECRET ??= "test-cron-secret";
  resetEnvCache();
}

async function insertUser(
  pool: Pool,
  opts: { username: string; role: "admin" | "builder" | "viewer" },
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (username, password_hash, role, display_name)
     VALUES ($1, 'x', $2::user_role, $3)
     ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [opts.username, opts.role, opts.username],
  );
  return result.rows[0]!.id;
}

function ctx(userId: string, role: RequestContext["role"]): RequestContext {
  return { userId, role, requestId: `req-concurrency-${role}` };
}

describe.skipIf(!connectionString)("concurrency (B9-04)", () => {
  let pool: Pool;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    ensureTestEnv(connectionString!);
    pool = await setupTestDatabase(connectionString);
    await resetDbClient();
  });

  afterAll(async () => {
    await resetDbClient();
    await teardown(pool);
  });

  it("double step complete: exactly one winner via status=open conditional update", async () => {
    const existingAdmin = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    const adminId =
      existingAdmin.rows[0]?.id ??
      (await insertUser(pool, { username: `conc_admin_${suffix}`, role: "admin" }));
    const builderId = await insertUser(pool, {
      username: `conc_builder_${suffix}`,
      role: "builder",
    });

    const adminCtx = ctx(adminId, "admin");
    const builderCtx = ctx(builderId, "builder");

    const draft = await flows.createDraft(adminCtx, { name: `Conc flow ${suffix}` });
    await flows.addStep(adminCtx, draft.id, {
      name: "Step 1",
      allowedRole: "builder",
      fields: [],
    });
    await flows.publish(adminCtx, draft.id);

    const invoice = await invoices.create(builderCtx, {
      invoiceNo: `CONC-${suffix}`,
      flowId: draft.id,
      partyName: "Concurrency Party",
      amountRupees: "100.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
    });

    const stepId = invoice.steps[0]!.id;

    const results = await Promise.allSettled([
      steps.complete(builderCtx, { invoiceId: invoice.id, invoiceStepId: stepId, data: {} }),
      steps.complete(adminCtx, { invoiceId: invoice.id, invoiceStepId: stepId, data: {} }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(Conflict);

    const db = getDb();
    const [row] = await db
      .select({ status: invoiceSteps.status, completedBy: invoiceSteps.completedBy })
      .from(invoiceSteps)
      .where(eq(invoiceSteps.id, stepId));
    expect(row?.status).toBe("completed");
    expect(row?.completedBy).toBeTruthy();
  });

  it("transferAdmin race sketch: one_admin unique index leaves exactly one admin", async () => {
    const existingAdmin = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    let adminId = existingAdmin.rows[0]?.id;
    if (!adminId) {
      adminId = await insertUser(pool, { username: `xfer_admin_${suffix}`, role: "admin" });
    }
    const b1 = await insertUser(pool, { username: `xfer_b1_${suffix}`, role: "builder" });
    const b2 = await insertUser(pool, { username: `xfer_b2_${suffix}`, role: "builder" });

    const adminCtx = ctx(adminId, "admin");

    const results = await Promise.allSettled([
      usersService.transferAdmin(adminCtx, { newAdminUserId: b1 }),
      usersService.transferAdmin(adminCtx, { newAdminUserId: b2 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    // At most one transfer should succeed; the other fails (Conflict / unique / demoted actor).
    expect(fulfilled.length).toBeLessThanOrEqual(1);
    expect(results.filter((r) => r.status === "rejected").length).toBeGreaterThanOrEqual(1);

    const db = getDb();
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    expect(admins.length).toBe(1);
  });
});
