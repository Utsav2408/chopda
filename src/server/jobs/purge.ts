/**
 * Purge job: permanently remove soft-deleted invoices past retention (B7-09).
 *
 * Order: delete stored files via adapter (only when no live docs share object_key),
 * then delete document / invoice_step / invoice rows. Audit log is never purged.
 * Idempotent; supports dry-run.
 */
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { audit } from "../audit/write.js";
import type { AppTx } from "../db/client.js";
import { getDb } from "../db/client.js";
import { auditLog, documents, invoices, invoiceSteps, users } from "../db/schema.js";
import type { RequestContext } from "../db/with-user.js";
import { UNDO_RETENTION_DAYS } from "../invoices/constants.js";
import { getStorageAdapter, type StorageAdapter } from "../storage/index.js";
import { log } from "../kernel/logger.js";
import { redactForAudit } from "../audit/write.js";

export type PurgeOptions = {
  /** Retention days after soft-delete (default UNDO_RETENTION_DAYS). */
  retentionDays?: number;
  /** When true, log planned work without deleting files or rows. */
  dryRun?: boolean;
  /** Clock injection for tests. */
  now?: Date;
  storage?: StorageAdapter;
  /** Actor for audit rows (cron uses a system admin context). */
  ctx: RequestContext;
};

export type PurgeResult = {
  dryRun: boolean;
  retentionDays: number;
  invoicesConsidered: number;
  invoicesPurged: number;
  documentsRemoved: number;
  filesDeleted: number;
  filesSkippedSharedKey: number;
};

async function countLiveRefs(
  tx: AppTx,
  objectKey: string,
  excludeDocIds: string[],
): Promise<number> {
  const rows = await tx
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.objectKey, objectKey),
        isNull(documents.deletedAt),
        excludeDocIds.length > 0
          ? sql`${documents.id} NOT IN (${sql.join(
              excludeDocIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`
          : sql`true`,
      ),
    );
  return rows.length;
}

/**
 * Run the purge job once. Safe to re-run (idempotent).
 */
export async function runPurge(opts: PurgeOptions): Promise<PurgeResult> {
  const retentionDays = opts.retentionDays ?? UNDO_RETENTION_DAYS;
  const dryRun = opts.dryRun ?? false;
  const now = opts.now ?? new Date();
  const storage = opts.storage ?? getStorageAdapter();
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);

  const result: PurgeResult = {
    dryRun,
    retentionDays,
    invoicesConsidered: 0,
    invoicesPurged: 0,
    documentsRemoved: 0,
    filesDeleted: 0,
    filesSkippedSharedKey: 0,
  };

  // Purge runs as a privileged job (cron). Use the pool without SET ROLE so
  // we can hard-delete rows; RLS soft-delete hide does not apply to DELETE.
  const db = getDb();

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  const auditCtx: RequestContext = {
    userId: admin?.id ?? opts.ctx.userId,
    role: "admin",
    requestId: opts.ctx.requestId,
  };

  const candidates = await db
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      deletedAt: invoices.deletedAt,
    })
    .from(invoices)
    .where(and(isNotNull(invoices.deletedAt), lt(invoices.deletedAt, cutoff)));

  result.invoicesConsidered = candidates.length;
  if (candidates.length === 0) {
    return result;
  }

  for (const inv of candidates) {
    await db.transaction(async (tx) => {
      const steps = await tx
        .select({ id: invoiceSteps.id })
        .from(invoiceSteps)
        .where(eq(invoiceSteps.invoiceId, inv.id));
      const stepIds = steps.map((s) => s.id);

      const docs =
        stepIds.length === 0
          ? []
          : await tx.select().from(documents).where(inArray(documents.invoiceStepId, stepIds));

      const docIds = docs.map((d) => d.id);
      const keysToMaybeDelete = new Map<string, string[]>();
      for (const d of docs) {
        const list = keysToMaybeDelete.get(d.objectKey) ?? [];
        list.push(d.id);
        keysToMaybeDelete.set(d.objectKey, list);
      }

      for (const [objectKey, idsForKey] of keysToMaybeDelete) {
        // Only delete storage when no *other live* document still references the key.
        // Soft-deleted docs on this invoice are about to be removed; other invoices'
        // live docs must keep the object.
        const liveElsewhere = await countLiveRefs(tx, objectKey, idsForKey);
        if (liveElsewhere > 0) {
          result.filesSkippedSharedKey += 1;
          continue;
        }
        if (dryRun) {
          result.filesDeleted += 1;
          continue;
        }
        try {
          await storage.delete(objectKey);
          result.filesDeleted += 1;
        } catch (err) {
          // Idempotent: missing object is fine.
          log.warn("purge storage delete failed (continuing)", {
            objectKey,
            error: err instanceof Error ? err.message : String(err),
          });
          result.filesDeleted += 1;
        }
      }

      if (dryRun) {
        result.documentsRemoved += docs.length;
        result.invoicesPurged += 1;
        log.info("purge dry-run invoice", {
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          documents: docs.length,
        });
        return;
      }

      if (docIds.length > 0) {
        await tx.delete(documents).where(inArray(documents.id, docIds));
        result.documentsRemoved += docIds.length;
      }
      if (stepIds.length > 0) {
        await tx.delete(invoiceSteps).where(inArray(invoiceSteps.id, stepIds));
      }
      await tx.delete(invoices).where(eq(invoices.id, inv.id));
      result.invoicesPurged += 1;

      const after = redactForAudit({
        invoiceNo: inv.invoiceNo,
        deletedAt: inv.deletedAt?.toISOString() ?? null,
        documentsRemoved: docs.length,
        retentionDays,
      }) as Record<string, unknown>;

      if (admin) {
        await audit({
          tx,
          ctx: auditCtx,
          action: "invoice.purge",
          entity: "invoice",
          entityId: inv.id,
          after,
        });
      } else {
        // No admin row yet (fresh DB) — still record purge with null actor.
        await tx.insert(auditLog).values({
          actorId: null,
          action: "invoice.purge",
          entity: "invoice",
          entityId: inv.id,
          before: null,
          after,
          requestId: opts.ctx.requestId,
        });
      }
    });
  }

  return result;
}
