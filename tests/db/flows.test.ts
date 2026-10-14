/**
 * Flow engine service tests (B4-03 … B4-09, B4-11 audit).
 * Requires a live Postgres URL (same as other tests/db).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { eq } from "drizzle-orm";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown } from "./harness.js";
import { resetDbClient, getDb } from "../../src/server/db/client.js";
import { resetEnvCache } from "../../src/server/env.js";
import { flowSteps, flowVersions } from "../../src/server/db/schema.js";
import type { RequestContext } from "../../src/server/db/with-user.js";
import { Conflict, Forbidden, Unauthenticated } from "../../src/server/kernel/errors.js";
import * as flows from "../../src/server/flows/service.js";
import { seedStandardAndCourierFlows } from "../../src/server/flows/seed-flows.js";

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
  // Avoid one_admin conflicts: use builder/viewer for most tests; admin only once.
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
  return { userId, role, requestId: `req-flows-${role}` };
}

describe.skipIf(!connectionString)("flows service (B4)", () => {
  let pool: Pool;
  const suffix = `${Date.now()}`;
  let adminId: string;
  let builderId: string;
  let viewerId: string;

  beforeAll(async () => {
    ensureTestEnv(connectionString!);
    pool = await setupTestDatabase(connectionString);
    await resetDbClient();

    // Prefer existing seed admin if present; otherwise create one builder-heavy suite.
    const existingAdmin = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    if (existingAdmin.rows[0]) {
      adminId = existingAdmin.rows[0].id;
    } else {
      adminId = await insertUser(pool, { username: `flow_admin_${suffix}`, role: "admin" });
    }
    builderId = await insertUser(pool, { username: `flow_builder_${suffix}`, role: "builder" });
    viewerId = await insertUser(pool, { username: `flow_viewer_${suffix}`, role: "viewer" });
  });

  afterAll(async () => {
    await resetDbClient();
    await teardown(pool);
  });

  it("viewer cannot createDraft; builder can (B4-03)", async () => {
    await expect(
      flows.createDraft(ctx(viewerId, "viewer"), { name: `V denied ${suffix}` }),
    ).rejects.toBeInstanceOf(Forbidden);

    await expect(flows.createDraft(null, { name: `anon ${suffix}` })).rejects.toBeInstanceOf(
      Unauthenticated,
    );

    const draft = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Draft A ${suffix}`,
    });
    expect(draft.status).toBe("draft");
    expect(draft.steps).toHaveLength(0);
    expect(draft.draftVersionId).toBeTruthy();
  });

  it("add/edit/remove/reorder on draft; published refused (B4-04)", async () => {
    const draft = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Edit flow ${suffix}`,
    });
    let detail = await flows.addStep(ctx(builderId, "builder"), draft.id, {
      name: "Step one",
      allowedRole: "builder",
      fields: [],
    });
    detail = await flows.addStep(ctx(builderId, "builder"), draft.id, {
      name: "Step two",
      allowedRole: "builder",
      fields: [{ key: "note", label: "Note", type: "text", required: false }],
    });
    expect(detail.steps.map((s) => s.name)).toEqual(["Step one", "Step two"]);

    const stepTwo = detail.steps[1]!;
    detail = await flows.editStep(ctx(builderId, "builder"), draft.id, stepTwo.id, {
      name: "Step two edited",
    });
    expect(detail.steps[1]!.name).toBe("Step two edited");

    const ids = detail.steps.map((s) => s.id);
    detail = await flows.reorderSteps(ctx(builderId, "builder"), draft.id, [ids[1]!, ids[0]!]);
    expect(detail.steps.map((s) => s.name)).toEqual(["Step two edited", "Step one"]);

    detail = await flows.removeStep(ctx(builderId, "builder"), draft.id, detail.steps[0]!.id);
    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0]!.stepNumber).toBe(1);

    detail = await flows.publish(ctx(builderId, "builder"), draft.id);
    expect(detail.status).toBe("published");
    expect(detail.publishedVersionNo).toBe(1);

    const publishedStepId = detail.steps[0]!.id;
    // Direct DB update on published steps must fail (trigger).
    // Drizzle wraps the Postgres error; walk the cause chain for the message.
    const db = getDb();
    let thrown: unknown;
    try {
      await db
        .update(flowSteps)
        .set({ name: "hacked" })
        .where(eq(flowSteps.id, publishedStepId));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeTruthy();
    const messages: string[] = [];
    for (let cur: unknown = thrown; cur; cur = (cur as { cause?: unknown }).cause) {
      if (cur instanceof Error) messages.push(cur.message);
      else messages.push(String(cur));
    }
    expect(messages.join("\n")).toMatch(/published/i);
  });

  it("publish twice gives v1 and v2; v1 byte-identical (B4-05)", async () => {
    const created = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Publish twice ${suffix}`,
    });
    await flows.addStep(ctx(builderId, "builder"), created.id, {
      name: "Only step",
      allowedRole: "builder",
      fields: [{ key: "ok", label: "OK", type: "confirm", required: true }],
    });
    const v1 = await flows.publish(ctx(builderId, "builder"), created.id);
    expect(v1.publishedVersionNo).toBe(1);
    const v1Steps = v1.steps;

    // Edit (forks draft) then publish again.
    const afterEdit = await flows.editStep(ctx(builderId, "builder"), created.id, v1Steps[0]!.id, {
      name: "Only step v2",
    });
    expect(afterEdit.status).toBe("draft");
    expect(afterEdit.publishedVersionNo).toBe(1);

    const v2 = await flows.publish(ctx(builderId, "builder"), created.id);
    expect(v2.publishedVersionNo).toBe(2);
    expect(v2.steps[0]!.name).toBe("Only step v2");

    // v1 row still unchanged in DB.
    const db = getDb();
    const versions = await db
      .select()
      .from(flowVersions)
      .where(eq(flowVersions.templateId, created.id));
    const publishedV1 = versions.find((v) => v.versionNo === 1 && v.publishedAt !== null);
    expect(publishedV1).toBeTruthy();
    const v1DbSteps = await db
      .select()
      .from(flowSteps)
      .where(eq(flowSteps.versionId, publishedV1!.id));
    expect(v1DbSteps[0]!.name).toBe("Only step");
    // Compare as values (JSON key order from jsonb is not guaranteed).
    expect(v1DbSteps[0]!.fields).toEqual([
      { key: "ok", label: "OK", type: "confirm", required: true },
    ]);
  });

  it("archive blocks new invoices (B4-06)", async () => {
    const created = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Archive me ${suffix}`,
    });
    await flows.addStep(ctx(builderId, "builder"), created.id, {
      name: "S",
      allowedRole: "builder",
      fields: [],
    });
    await flows.publish(ctx(builderId, "builder"), created.id);
    expect(await flows.canStartNewInvoices(ctx(builderId, "builder"), created.id)).toBe(true);

    await flows.archive(ctx(builderId, "builder"), created.id);
    expect(await flows.canStartNewInvoices(ctx(builderId, "builder"), created.id)).toBe(false);
    await expect(
      flows.assertCanStartNewInvoices(ctx(builderId, "builder"), created.id),
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("list/get expose chips, state, version, active count (B4-07)", async () => {
    const created = await flows.createDraft(ctx(builderId, "builder"), {
      name: `List me ${suffix}`,
    });
    await flows.addStep(ctx(builderId, "builder"), created.id, {
      name: "Alpha",
      allowedRole: "builder",
      fields: [],
    });
    await flows.publish(ctx(builderId, "builder"), created.id);

    const listed = await flows.list(ctx(viewerId, "viewer"));
    const item = listed.find((f) => f.id === created.id);
    expect(item).toBeTruthy();
    expect(item!.status).toBe("published");
    expect(item!.publishedVersionNo).toBe(1);
    expect(item!.steps).toEqual([{ stepNumber: 1, name: "Alpha" }]);
    expect(item!.activeInvoiceCount).toBe(0);

    const got = await flows.get(ctx(viewerId, "viewer"), created.id);
    expect(got.steps[0]!.name).toBe("Alpha");
  });

  it("seed Standard vs Courier differs only at step 4 (B4-08, B4-09)", async () => {
    // Retire pre-B4 raw fixtures so the service seed can create the 5-step pair.
    for (const name of ["Standard", "Courier"] as const) {
      const existing = await pool.query<{ id: string; n: string }>(
        `SELECT ft.id, coalesce(count(fs.id), 0)::text AS n
         FROM flow_templates ft
         LEFT JOIN flow_versions fv
           ON fv.template_id = ft.id AND fv.published_at IS NOT NULL
         LEFT JOIN flow_steps fs ON fs.version_id = fv.id
         WHERE ft.name = $1
         GROUP BY ft.id`,
        [name],
      );
      const row = existing.rows[0];
      if (row && Number(row.n) !== 5) {
        await pool.query(`UPDATE flow_templates SET name = $1 WHERE id = $2`, [
          `${name} (legacy ${suffix})`,
          row.id,
        ]);
      }
    }

    const { standardId, courierId } = await seedStandardAndCourierFlows(ctx(adminId, "admin"));
    const diff = await flows.diffAgainst(ctx(viewerId, "viewer"), standardId, courierId);
    expect(diff.differingStepNumbers).toEqual([4]);

    const standard = await flows.get(ctx(viewerId, "viewer"), standardId);
    const courier = await flows.get(ctx(viewerId, "viewer"), courierId);
    expect(standard.status).toBe("published");
    expect(courier.status).toBe("published");
    expect(standard.steps).toHaveLength(5);
    expect(courier.steps).toHaveLength(5);
    expect(courier.steps[3]!.fields.some((f) => f.key === "courier")).toBe(true);
  });

  it("duplicate copies steps into a new draft (B4-03)", async () => {
    const { standardId } = await seedStandardAndCourierFlows(ctx(adminId, "admin"));
    const copy = await flows.duplicate(ctx(builderId, "builder"), standardId);
    expect(copy.status).toBe("draft");
    expect(copy.steps).toHaveLength(5);
    expect(copy.name).toMatch(/copy/i);
  });

  it("audit rows for create/edit/publish/archive (B4-11)", async () => {
    const created = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Audit flow ${suffix}`,
    });
    await flows.addStep(ctx(builderId, "builder"), created.id, {
      name: "A",
      allowedRole: "builder",
      fields: [],
    });
    await flows.publish(ctx(builderId, "builder"), created.id);
    await flows.archive(ctx(builderId, "builder"), created.id);

    const db = getDb();
    // Admin can read audit under RLS; use pool as owner for assertion.
    const rows = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log
       WHERE entity = 'flow_template' AND entity_id = $1
       ORDER BY at`,
      [created.id],
    );
    const actions = rows.rows.map((r) => r.action);
    expect(actions).toContain("flow.create");
    expect(actions).toContain("flow.edit");
    expect(actions).toContain("flow.publish");
    expect(actions).toContain("flow.archive");
  });
});
