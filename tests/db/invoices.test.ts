/**
 * Invoice + step engine DB tests (B5-03…B5-11).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown } from "./harness.js";
import { resetDbClient } from "../../src/server/db/client.js";
import { resetEnvCache } from "../../src/server/env.js";
import type { RequestContext } from "../../src/server/db/with-user.js";
import {
  Conflict,
  Forbidden,
  NotFound,
  Unauthenticated,
  Validation,
} from "../../src/server/kernel/errors.js";
import * as flows from "../../src/server/flows/service.js";
import * as invoices from "../../src/server/invoices/service.js";
import * as steps from "../../src/server/steps/service.js";

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
  return { userId, role, requestId: `req-inv-${role}` };
}

describe.skipIf(!connectionString)("invoices + steps (B5)", () => {
  let pool: Pool;
  const suffix = `${Date.now()}`;
  let adminId: string;
  let builderId: string;
  let viewerId: string;
  let flowId: string;
  let publishedVersionId: string;

  beforeAll(async () => {
    ensureTestEnv(connectionString!);
    pool = await setupTestDatabase(connectionString);
    await resetDbClient();

    const existingAdmin = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    adminId = existingAdmin.rows[0]
      ? existingAdmin.rows[0].id
      : await insertUser(pool, { username: `inv_admin_${suffix}`, role: "admin" });
    builderId = await insertUser(pool, { username: `inv_builder_${suffix}`, role: "builder" });
    viewerId = await insertUser(pool, { username: `inv_viewer_${suffix}`, role: "viewer" });

    const draft = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Inv Flow ${suffix}`,
    });
    await flows.addStep(ctx(builderId, "builder"), draft.id, {
      name: "Raise",
      allowedRole: "builder",
      fields: [{ key: "raised", label: "Raised", type: "confirm", required: true }],
    });
    await flows.addStep(ctx(builderId, "builder"), draft.id, {
      name: "Courier email",
      allowedRole: "builder",
      fields: [
        { key: "courier", label: "Courier", type: "text", required: true },
        { key: "email_sent", label: "Email sent", type: "confirm", required: true },
        { key: "email_proof", label: "Proof", type: "file", required: false },
      ],
    });
    await flows.addStep(ctx(builderId, "builder"), draft.id, {
      name: "Pay",
      allowedRole: "admin",
      fields: [{ key: "paid", label: "Paid", type: "confirm", required: true }],
    });
    const published = await flows.publish(ctx(builderId, "builder"), draft.id);
    flowId = published.id;
    publishedVersionId = published.workingVersionId!;
  });

  afterAll(async () => {
    await resetDbClient();
    await teardown(pool);
  });

  it("viewer cannot create; builder pins flow_version_id and creates steps (B5-03)", async () => {
    await expect(
      invoices.create(ctx(viewerId, "viewer"), {
        invoiceNo: `INV-V-${suffix}`,
        partyName: "Denied",
        amountRupees: "10.00",
        issueDate: "2026-10-01",
        ownerId: builderId,
        flowId,
      }),
    ).rejects.toBeInstanceOf(Forbidden);

    await expect(
      invoices.create(null, {
        invoiceNo: `INV-A-${suffix}`,
        partyName: "Anon",
        amountRupees: "10.00",
        issueDate: "2026-10-01",
        ownerId: builderId,
        flowId,
      }),
    ).rejects.toBeInstanceOf(Unauthenticated);

    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `INV-B-${suffix}`,
      partyName: "Acme",
      amountRupees: "100.50",
      issueDate: "2026-10-01",
      dueDate: "2026-10-31",
      ownerId: builderId,
      flowId,
    });

    expect(inv.flowVersionId).toBe(publishedVersionId);
    expect(inv.amountRupees).toBe("100.50");
    expect(inv.amountMinor).toBe("10050");
    expect(inv.steps).toHaveLength(3);
    expect(inv.currentStepId).toBe(inv.steps[0]!.flowStepId);
    expect(inv.status).toBe("open");
  });

  it("update refuses flow change; allows non-flow fields (B5-04)", async () => {
    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `INV-U-${suffix}`,
      partyName: "Old",
      amountRupees: "20.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
      flowId,
    });

    await expect(
      invoices.update(ctx(builderId, "builder"), inv.id, {
        partyName: "New",
        flowId,
      } as never),
    ).rejects.toBeInstanceOf(Validation);

    const updated = await invoices.update(ctx(builderId, "builder"), inv.id, {
      partyName: "New Name",
      amountRupees: "25.00",
    });
    expect(updated.partyName).toBe("New Name");
    expect(updated.amountRupees).toBe("25.00");
    expect(updated.flowVersionId).toBe(inv.flowVersionId);
  });

  it("steps.complete enforces order, role, validation, email rule (B5-05/B5-08)", async () => {
    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `INV-S-${suffix}`,
      partyName: "Steps",
      amountRupees: "30.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
      flowId,
    });

    const step0 = inv.steps[0]!;
    const step1 = inv.steps[1]!;
    const step2 = inv.steps[2]!;

    // Out of order
    await expect(
      steps.complete(ctx(builderId, "builder"), {
        invoiceId: inv.id,
        invoiceStepId: step1.id,
        data: { courier: "X", email_sent: true },
      }),
    ).rejects.toBeInstanceOf(Conflict);

    // Missing required field
    await expect(
      steps.complete(ctx(builderId, "builder"), {
        invoiceId: inv.id,
        invoiceStepId: step0.id,
        data: {},
      }),
    ).rejects.toBeInstanceOf(Validation);

    // Complete step 0
    let detail = await steps.complete(ctx(builderId, "builder"), {
      invoiceId: inv.id,
      invoiceStepId: step0.id,
      data: { raised: true },
    });
    expect(detail.steps[0]!.status).toBe("completed");
    expect(detail.steps[0]!.completedBy).toBe(builderId);
    expect(detail.currentStepId).toBe(step1.flowStepId);

    // Repeat refused
    await expect(
      steps.complete(ctx(builderId, "builder"), {
        invoiceId: inv.id,
        invoiceStepId: step0.id,
        data: { raised: true },
      }),
    ).rejects.toBeInstanceOf(Conflict);

    // Courier without email_sent
    await expect(
      steps.complete(ctx(builderId, "builder"), {
        invoiceId: inv.id,
        invoiceStepId: step1.id,
        data: { courier: "BlueDart", email_sent: false },
      }),
    ).rejects.toBeInstanceOf(Validation);

    detail = await steps.complete(ctx(builderId, "builder"), {
      invoiceId: inv.id,
      invoiceStepId: step1.id,
      data: { courier: "BlueDart", email_sent: true },
    });
    expect(detail.currentStepId).toBe(step2.flowStepId);

    // Wrong role for admin-only payment step
    await expect(
      steps.complete(ctx(builderId, "builder"), {
        invoiceId: inv.id,
        invoiceStepId: step2.id,
        data: { paid: true },
      }),
    ).rejects.toBeInstanceOf(Forbidden);

    detail = await steps.complete(ctx(adminId, "admin"), {
      invoiceId: inv.id,
      invoiceStepId: step2.id,
      data: { paid: true },
    });
    expect(detail.storedStatus).toBe("completed");
    expect(detail.status).toBe("completed");
    expect(detail.currentStepId).toBeNull();
  });

  it("get hides soft-deleted from non-admin (B5-07)", async () => {
    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `INV-D-${suffix}`,
      partyName: "Del",
      amountRupees: "5.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
      flowId,
    });

    await pool.query(`UPDATE invoices SET deleted_at = now() WHERE id = $1`, [inv.id]);

    await expect(invoices.get(ctx(builderId, "builder"), inv.id)).rejects.toBeInstanceOf(NotFound);
    await expect(invoices.get(ctx(viewerId, "viewer"), inv.id)).rejects.toBeInstanceOf(NotFound);

    const adminView = await invoices.get(ctx(adminId, "admin"), inv.id);
    expect(adminView.deletedAt).not.toBeNull();
  });

  it("flow-version pinning survives republish (B5-11)", async () => {
    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `INV-P-${suffix}`,
      partyName: "Pin",
      amountRupees: "40.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
      flowId,
    });
    const pinned = inv.flowVersionId;

    // Edit + republish creates a new version.
    await flows.addStep(ctx(builderId, "builder"), flowId, {
      name: "Extra",
      allowedRole: "builder",
      fields: [],
    });
    const republished = await flows.publish(ctx(builderId, "builder"), flowId);
    expect(republished.publishedVersionNo).toBeGreaterThan(1);
    expect(republished.workingVersionId).not.toBe(pinned);

    const still = await invoices.get(ctx(builderId, "builder"), inv.id);
    expect(still.flowVersionId).toBe(pinned);
    expect(still.steps).toHaveLength(3);

    const audit = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity = 'invoice' AND entity_id = $1 AND action = 'invoice.create'`,
      [inv.id],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });
});
