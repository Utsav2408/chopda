/**
 * Soft delete / undo / listDeleted (B7-07, B7-08).
 */
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { audit } from "../audit/write.js";
import { requireRole, type AuthContext } from "../authz/index.js";
import type { AppTx } from "../db/client.js";
import { documents, invoices, invoiceSteps } from "../db/schema.js";
import { withUser } from "../db/with-user.js";
import { Conflict, NotFound, Validation } from "../kernel/errors.js";
import { UNDO_RETENTION_DAYS } from "./constants.js";
import * as repo from "./repo.js";

export type DeletedInvoiceListItem = {
  id: string;
  invoiceNo: string;
  partyName: string;
  deletedAt: Date;
  /** Whole days remaining in the undo window (0 = last day; negative refused). */
  daysLeft: number;
};

function daysLeftUntilPurge(
  deletedAt: Date,
  now: Date,
  retentionDays = UNDO_RETENTION_DAYS,
): number {
  const purgeAt = deletedAt.getTime() + retentionDays * 86_400_000;
  return Math.ceil((purgeAt - now.getTime()) / 86_400_000);
}

async function softDeleteDocumentsForInvoice(
  tx: AppTx,
  invoiceId: string,
  at: Date,
): Promise<number> {
  const steps = await tx
    .select({ id: invoiceSteps.id })
    .from(invoiceSteps)
    .where(eq(invoiceSteps.invoiceId, invoiceId));
  if (steps.length === 0) return 0;
  const stepIds = steps.map((s) => s.id);
  const updated = await tx
    .update(documents)
    .set({ deletedAt: at })
    .where(and(inArray(documents.invoiceStepId, stepIds), isNull(documents.deletedAt)))
    .returning({ id: documents.id });
  return updated.length;
}

async function restoreDocumentsForInvoice(tx: AppTx, invoiceId: string): Promise<number> {
  const steps = await tx
    .select({ id: invoiceSteps.id })
    .from(invoiceSteps)
    .where(eq(invoiceSteps.invoiceId, invoiceId));
  if (steps.length === 0) return 0;
  const stepIds = steps.map((s) => s.id);
  const updated = await tx
    .update(documents)
    .set({ deletedAt: null })
    .where(and(inArray(documents.invoiceStepId, stepIds), isNotNull(documents.deletedAt)))
    .returning({ id: documents.id });
  return updated.length;
}

/**
 * Admin-only soft delete: sets invoice + documents deleted_at, audits (B7-07).
 */
export async function softDelete(
  ctx: AuthContext,
  invoiceId: string,
  opts?: { now?: Date },
): Promise<{ id: string; deletedAt: Date }> {
  const authed = requireRole(ctx, "admin");
  const now = opts?.now ?? new Date();

  return withUser(authed, async (tx) => {
    const invoice = await repo.getInvoiceById(tx, invoiceId);
    if (!invoice) throw new NotFound();
    if (invoice.deletedAt) {
      throw new Conflict("Invoice is already deleted");
    }

    const [updated] = await tx
      .update(invoices)
      .set({ deletedAt: now })
      .where(eq(invoices.id, invoiceId))
      .returning();
    if (!updated?.deletedAt) throw new NotFound();

    const docsHidden = await softDeleteDocumentsForInvoice(tx, invoiceId, now);

    await audit({
      tx,
      ctx: authed,
      action: "invoice.softDelete",
      entity: "invoice",
      entityId: invoiceId,
      before: { deletedAt: null },
      after: {
        deletedAt: updated.deletedAt.toISOString(),
        documentsHidden: docsHidden,
        retentionDays: UNDO_RETENTION_DAYS,
      },
    });

    return { id: updated.id, deletedAt: updated.deletedAt };
  });
}

/**
 * Undo soft delete within the retention window (B7-08). Admin only.
 */
export async function undo(
  ctx: AuthContext,
  invoiceId: string,
  opts?: { now?: Date; retentionDays?: number },
): Promise<{ id: string }> {
  const authed = requireRole(ctx, "admin");
  const now = opts?.now ?? new Date();
  const retentionDays = opts?.retentionDays ?? UNDO_RETENTION_DAYS;

  return withUser(authed, async (tx) => {
    const invoice = await repo.getInvoiceById(tx, invoiceId);
    if (!invoice) throw new NotFound();
    if (!invoice.deletedAt) {
      throw new Conflict("Invoice is not deleted");
    }

    const left = daysLeftUntilPurge(invoice.deletedAt, now, retentionDays);
    if (left <= 0) {
      throw new Validation(`Undo window of ${retentionDays} days has expired (days left: ${left})`);
    }

    const [updated] = await tx
      .update(invoices)
      .set({ deletedAt: null })
      .where(eq(invoices.id, invoiceId))
      .returning();
    if (!updated) throw new NotFound();

    const docsRestored = await restoreDocumentsForInvoice(tx, invoiceId);

    await audit({
      tx,
      ctx: authed,
      action: "invoice.undo",
      entity: "invoice",
      entityId: invoiceId,
      before: { deletedAt: invoice.deletedAt.toISOString() },
      after: { deletedAt: null, documentsRestored: docsRestored },
    });

    return { id: updated.id };
  });
}

/**
 * Recently deleted invoices with days left in the undo window (B7-08). Admin only.
 */
export async function listDeleted(
  ctx: AuthContext,
  opts?: { now?: Date; retentionDays?: number },
): Promise<DeletedInvoiceListItem[]> {
  const authed = requireRole(ctx, "admin");
  const now = opts?.now ?? new Date();
  const retentionDays = opts?.retentionDays ?? UNDO_RETENTION_DAYS;

  return withUser(authed, async (tx) => {
    const rows = await tx
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        partyName: invoices.partyName,
        deletedAt: invoices.deletedAt,
      })
      .from(invoices)
      .where(isNotNull(invoices.deletedAt))
      .orderBy(sql`${invoices.deletedAt} desc`);

    return rows
      .filter((r): r is typeof r & { deletedAt: Date } => r.deletedAt !== null)
      .map((r) => ({
        id: r.id,
        invoiceNo: r.invoiceNo,
        partyName: r.partyName,
        deletedAt: r.deletedAt,
        daysLeft: daysLeftUntilPurge(r.deletedAt, now, retentionDays),
      }))
      .filter((r) => r.daysLeft > 0);
  });
}

export { daysLeftUntilPurge, UNDO_RETENTION_DAYS };
