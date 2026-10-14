/**
 * Invoice history from audit_log (B7-05).
 */
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { canSeeInvoice, type AuthContext } from "../authz/index.js";
import { auditLog, documents, invoiceSteps } from "../db/schema.js";
import { withUser } from "../db/with-user.js";
import { NotFound } from "../kernel/errors.js";
import * as invoiceRepo from "../invoices/repo.js";
import { assertCanReadInvoices } from "../invoices/service.js";

export type HistoryEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  at: Date;
  before: unknown;
  after: unknown;
};

/**
 * Actions non-admins may see on an invoice history panel.
 * Admins see every audit row tied to the invoice.
 */
const NON_ADMIN_ACTIONS = new Set([
  "invoice.create",
  "invoice.update",
  "invoice.softDelete",
  "invoice.undo",
  "invoice.step.complete",
  "document.upload",
  "document.view",
]);

/**
 * History for one invoice, newest first, role-filtered (B7-05).
 */
export async function forInvoice(ctx: AuthContext, invoiceId: string): Promise<HistoryEntry[]> {
  const authed = assertCanReadInvoices(ctx);

  return withUser(authed, async (tx) => {
    const invoice = await invoiceRepo.getInvoiceById(tx, invoiceId);
    if (!invoice || !canSeeInvoice(authed, invoice)) {
      throw new NotFound();
    }

    const steps = await tx
      .select({ id: invoiceSteps.id })
      .from(invoiceSteps)
      .where(eq(invoiceSteps.invoiceId, invoiceId));
    const stepIds = steps.map((s) => s.id);

    let docIds: string[] = [];
    if (stepIds.length > 0) {
      const docs = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(inArray(documents.invoiceStepId, stepIds));
      docIds = docs.map((d) => d.id);
    }

    const entityFilters = [and(eq(auditLog.entity, "invoice"), eq(auditLog.entityId, invoiceId))];
    if (stepIds.length > 0) {
      entityFilters.push(
        and(eq(auditLog.entity, "invoice_step"), inArray(auditLog.entityId, stepIds)),
      );
      // step.complete may audit entity=invoice with step info, or entity invoice_step
    }
    if (docIds.length > 0) {
      entityFilters.push(and(eq(auditLog.entity, "document"), inArray(auditLog.entityId, docIds)));
    }

    const rows = await tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        actorId: auditLog.actorId,
        at: auditLog.at,
        before: auditLog.before,
        after: auditLog.after,
      })
      .from(auditLog)
      .where(or(...entityFilters))
      .orderBy(desc(auditLog.at));

    let entries: HistoryEntry[] = rows;

    if (authed.role !== "admin") {
      entries = entries.filter((e) => NON_ADMIN_ACTIONS.has(e.action));
    }

    return entries;
  });
}
