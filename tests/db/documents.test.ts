/**
 * Document upload/download DB + storage tests (B6-05 … B6-08).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown } from "./harness.js";
import { resetDbClient } from "../../src/server/db/client.js";
import { resetEnvCache } from "../../src/server/env.js";
import type { RequestContext } from "../../src/server/db/with-user.js";
import { Conflict, Forbidden } from "../../src/server/kernel/errors.js";
import * as flows from "../../src/server/flows/service.js";
import * as invoices from "../../src/server/invoices/service.js";
import * as documents from "../../src/server/documents/service.js";
import { createLocalStorageAdapter } from "../../src/server/storage/index.js";
import { createMemoryStorageAdapter } from "../storage/memory-fake.js";

const connectionString = resolveTestDatabaseUrl();

/** Minimal valid PDF magic bytes. */
const PDF_BYTES = Buffer.from("%PDF-1.4\n%fake test pdf content\n");

function ensureTestEnv(url: string, storageDir: string): void {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_URL_DIRECT = url;
  process.env.SESSION_SECRET ??= "test-session-secret-32-characters!!";
  process.env.ENCRYPTION_KEY ??= "test-encryption-key-32-characters!!";
  process.env.STORAGE_PROVIDER = "local";
  process.env.FILE_STORAGE_DIR = storageDir;
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
  return { userId, role, requestId: `req-doc-${role}` };
}

describe.skipIf(!connectionString)("documents upload/download (B6-05..08)", () => {
  let pool: Pool;
  let storageDir: string;
  const suffix = `${Date.now()}`;
  let builderId: string;
  let viewerId: string;
  let invoiceStepId: string;
  let invoiceId: string;
  const memory = createMemoryStorageAdapter();

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "chopda-doc-"));
    ensureTestEnv(connectionString!, storageDir);
    pool = await setupTestDatabase(connectionString);
    await resetDbClient();

    const existingAdmin = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    if (!existingAdmin.rows[0]) {
      await insertUser(pool, { username: `doc_admin_${suffix}`, role: "admin" });
    }
    builderId = await insertUser(pool, { username: `doc_builder_${suffix}`, role: "builder" });
    viewerId = await insertUser(pool, { username: `doc_viewer_${suffix}`, role: "viewer" });

    const draft = await flows.createDraft(ctx(builderId, "builder"), {
      name: `Doc Flow ${suffix}`,
    });
    await flows.addStep(ctx(builderId, "builder"), draft.id, {
      name: "Upload",
      allowedRole: "builder",
      fields: [{ key: "invoice_file", label: "File", type: "file", required: true }],
    });
    await flows.publish(ctx(builderId, "builder"), draft.id);

    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `DOC-${suffix}`,
      partyName: "Docs Co",
      amountRupees: "50.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
      flowId: draft.id,
    });
    invoiceId = inv.id;
    invoiceStepId = inv.steps[0]!.id;
  });

  afterAll(async () => {
    await resetDbClient();
    await teardown(pool);
    await rm(storageDir, { recursive: true, force: true });
  });

  it("viewer cannot upload; builder uploads and links field (B6-05)", async () => {
    await expect(
      documents.upload(
        ctx(viewerId, "viewer"),
        { invoiceStepId, filename: "a.pdf", bytes: PDF_BYTES, fieldKey: "invoice_file" },
        { storage: memory, storageProvider: "local" },
      ),
    ).rejects.toBeInstanceOf(Forbidden);

    const result = await documents.upload(
      ctx(builderId, "builder"),
      { invoiceStepId, filename: "invoice.pdf", bytes: PDF_BYTES, fieldKey: "invoice_file" },
      { storage: memory, storageProvider: "local" },
    );

    expect(result.documentId).toBeTruthy();
    expect(result.mimeType).toBe("application/pdf");
    expect(result.duplicateOfExisting).toBe(false);
    expect(await memory.exists(result.objectKey)).toBe(true);

    const detail = await invoices.get(ctx(builderId, "builder"), invoiceId);
    expect(detail.steps[0]!.data.invoice_file).toBe(result.documentId);
    expect(detail.steps[0]!.documents.some((d) => d.id === result.documentId)).toBe(true);
  });

  it("sha256 dedupe reuses object_key (B6-05)", async () => {
    const first = await documents.upload(
      ctx(builderId, "builder"),
      { invoiceStepId, filename: "one.pdf", bytes: PDF_BYTES },
      { storage: memory, storageProvider: "local" },
    );
    const second = await documents.upload(
      ctx(builderId, "builder"),
      { invoiceStepId, filename: "two.pdf", bytes: PDF_BYTES },
      { storage: memory, storageProvider: "local" },
    );
    expect(second.duplicateOfExisting).toBe(true);
    expect(second.objectKey).toBe(first.objectKey);
    expect(second.documentId).not.toBe(first.documentId);
  });

  it("orphan cleanup deletes put object when insert fails (B6-05)", async () => {
    const inv = await invoices.create(ctx(builderId, "builder"), {
      invoiceNo: `DOC-ORPH-${suffix}`,
      partyName: "Orphan",
      amountRupees: "1.00",
      issueDate: "2026-10-01",
      ownerId: builderId,
      flowId: (await invoices.get(ctx(builderId, "builder"), invoiceId)).flowTemplateId,
    });
    const stepId = inv.steps[0]!.id;
    const uniqueBytes = Buffer.from(`%PDF-1.4 orphan-${suffix}\n`);
    let putKey: string | null = null;

    const sabotagingStorage = {
      async put(key: string, data: Buffer | Uint8Array | string) {
        await memory.put(key, data);
        putKey = key;
        // Race: mark step completed after put so the insert transaction refuses.
        await pool.query(
          `UPDATE invoice_steps SET status = 'completed', completed_by = $2, completed_at = now()
           WHERE id = $1`,
          [stepId, builderId],
        );
      },
      getStream: memory.getStream.bind(memory),
      delete: memory.delete.bind(memory),
      exists: memory.exists.bind(memory),
      healthCheck: memory.healthCheck.bind(memory),
    };

    await expect(
      documents.upload(
        ctx(builderId, "builder"),
        { invoiceStepId: stepId, filename: "orphan.pdf", bytes: uniqueBytes },
        { storage: sabotagingStorage, storageProvider: "local" },
      ),
    ).rejects.toBeInstanceOf(Conflict);

    expect(putKey).not.toBeNull();
    expect(await memory.exists(putKey!)).toBe(false);
  });

  it("download streams for permitted roles and audits view (B6-06)", async () => {
    const uploaded = await documents.upload(
      ctx(builderId, "builder"),
      {
        invoiceStepId,
        filename: "dl.pdf",
        bytes: Buffer.from("%PDF-1.4 downloadable\n"),
      },
      { storage: memory, storageProvider: "local" },
    );

    const dl = await documents.download(ctx(viewerId, "viewer"), uploaded.documentId, {
      storage: memory,
    });
    expect(dl.mimeType).toBe("application/pdf");
    expect(dl.cacheControl).toContain("private");
    expect(dl.cacheControl).toContain("immutable");

    const chunks: Buffer[] = [];
    for await (const chunk of dl.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString("utf8")).toContain("%PDF");

    const audit = await pool.query(
      `SELECT action FROM audit_log WHERE entity = 'document' AND entity_id = $1 AND action = 'document.view'`,
      [uploaded.documentId],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("local adapter put/get works for a fresh upload (smoke)", async () => {
    const local = createLocalStorageAdapter();
    const result = await documents.upload(
      ctx(builderId, "builder"),
      {
        invoiceStepId,
        filename: "local.pdf",
        bytes: Buffer.from("%PDF-1.4 local adapter\n"),
      },
      { storage: local, storageProvider: "local" },
    );
    expect(await local.exists(result.objectKey)).toBe(true);
  });
});
