/**
 * Invoice / invoice_step persistence (B5). Called only from services with AppTx.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AppTx } from "../db/client.js";
import { documents, flowSteps, invoices, invoiceSteps } from "../db/schema.js";

export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceStepRow = typeof invoiceSteps.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;

export type InvoiceInsert = {
  invoiceNo: string;
  flowVersionId: string;
  currentStepId: string | null;
  status: string;
  partyName: string;
  amountMinor: bigint;
  currency?: string;
  issueDate: string;
  dueDate: string | null;
  ownerId: string;
  extra?: Record<string, unknown>;
  createdBy: string;
};

export async function insertInvoice(tx: AppTx, input: InvoiceInsert): Promise<InvoiceRow> {
  const [row] = await tx
    .insert(invoices)
    .values({
      invoiceNo: input.invoiceNo,
      flowVersionId: input.flowVersionId,
      currentStepId: input.currentStepId,
      status: input.status,
      partyName: input.partyName,
      amountMinor: input.amountMinor,
      currency: input.currency ?? "INR",
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      ownerId: input.ownerId,
      extra: input.extra ?? {},
      createdBy: input.createdBy,
    })
    .returning();
  return row!;
}

export async function getInvoiceById(
  tx: AppTx,
  invoiceId: string,
): Promise<InvoiceRow | undefined> {
  const [row] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  return row;
}

export async function getInvoiceByNo(
  tx: AppTx,
  invoiceNo: string,
): Promise<InvoiceRow | undefined> {
  const [row] = await tx.select().from(invoices).where(eq(invoices.invoiceNo, invoiceNo)).limit(1);
  return row;
}

export async function updateInvoiceRow(
  tx: AppTx,
  invoiceId: string,
  patch: Partial<{
    invoiceNo: string;
    partyName: string;
    amountMinor: bigint;
    issueDate: string;
    dueDate: string | null;
    ownerId: string;
    extra: Record<string, unknown>;
    status: string;
    currentStepId: string | null;
  }>,
): Promise<InvoiceRow | undefined> {
  const [row] = await tx.update(invoices).set(patch).where(eq(invoices.id, invoiceId)).returning();
  return row;
}

export async function insertInvoiceSteps(
  tx: AppTx,
  rows: { invoiceId: string; flowStepId: string; status?: string }[],
): Promise<InvoiceStepRow[]> {
  if (rows.length === 0) return [];
  return tx
    .insert(invoiceSteps)
    .values(
      rows.map((r) => ({
        invoiceId: r.invoiceId,
        flowStepId: r.flowStepId,
        status: r.status ?? "open",
        data: {},
      })),
    )
    .returning();
}

export async function listInvoiceSteps(tx: AppTx, invoiceId: string): Promise<InvoiceStepRow[]> {
  return tx.select().from(invoiceSteps).where(eq(invoiceSteps.invoiceId, invoiceId));
}

/** Invoice steps joined with flow step position/name for ordering. */
export async function listInvoiceStepsWithFlow(
  tx: AppTx,
  invoiceId: string,
): Promise<
  (InvoiceStepRow & {
    position: number;
    stepName: string;
    allowedRole: "admin" | "builder" | "viewer";
    fields: unknown;
  })[]
> {
  const rows = await tx
    .select({
      id: invoiceSteps.id,
      invoiceId: invoiceSteps.invoiceId,
      flowStepId: invoiceSteps.flowStepId,
      status: invoiceSteps.status,
      completedBy: invoiceSteps.completedBy,
      completedAt: invoiceSteps.completedAt,
      data: invoiceSteps.data,
      position: flowSteps.position,
      stepName: flowSteps.name,
      allowedRole: flowSteps.allowedRole,
      fields: flowSteps.fields,
    })
    .from(invoiceSteps)
    .innerJoin(flowSteps, eq(invoiceSteps.flowStepId, flowSteps.id))
    .where(eq(invoiceSteps.invoiceId, invoiceId))
    .orderBy(asc(flowSteps.position));
  return rows;
}

export async function getInvoiceStepById(
  tx: AppTx,
  invoiceStepId: string,
): Promise<InvoiceStepRow | undefined> {
  const [row] = await tx
    .select()
    .from(invoiceSteps)
    .where(eq(invoiceSteps.id, invoiceStepId))
    .limit(1);
  return row;
}

export async function completeInvoiceStep(
  tx: AppTx,
  invoiceStepId: string,
  input: {
    completedBy: string;
    completedAt: Date;
    data: Record<string, unknown>;
  },
): Promise<InvoiceStepRow | undefined> {
  // Conditional update: concurrent completers race; only one row matches
  // status='open' (B9-04). Loser gets undefined → Conflict at service layer.
  const [row] = await tx
    .update(invoiceSteps)
    .set({
      status: "completed",
      completedBy: input.completedBy,
      completedAt: input.completedAt,
      data: input.data,
    })
    .where(and(eq(invoiceSteps.id, invoiceStepId), eq(invoiceSteps.status, "open")))
    .returning();
  return row;
}

export async function updateInvoiceStepData(
  tx: AppTx,
  invoiceStepId: string,
  data: Record<string, unknown>,
): Promise<InvoiceStepRow | undefined> {
  const [row] = await tx
    .update(invoiceSteps)
    .set({ data })
    .where(eq(invoiceSteps.id, invoiceStepId))
    .returning();
  return row;
}

export async function listDocumentsForInvoiceSteps(
  tx: AppTx,
  invoiceStepIds: string[],
): Promise<DocumentRow[]> {
  if (invoiceStepIds.length === 0) return [];
  return tx
    .select()
    .from(documents)
    .where(and(inArray(documents.invoiceStepId, invoiceStepIds), isNull(documents.deletedAt)));
}

export async function findDocumentBySha256(
  tx: AppTx,
  sha256: string,
): Promise<DocumentRow | undefined> {
  const [row] = await tx
    .select()
    .from(documents)
    .where(and(eq(documents.sha256, sha256), isNull(documents.deletedAt)))
    .limit(1);
  return row;
}

export async function getDocumentById(
  tx: AppTx,
  documentId: string,
): Promise<DocumentRow | undefined> {
  const [row] = await tx.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return row;
}

export async function insertDocument(
  tx: AppTx,
  input: {
    id?: string;
    invoiceStepId: string;
    storageProvider: string;
    objectKey: string;
    originalFilename: string;
    sha256: string;
    mimeType: string;
    sizeBytes: bigint;
    uploadedBy: string;
    scanStatus?: string;
  },
): Promise<DocumentRow> {
  const [row] = await tx
    .insert(documents)
    .values({
      ...(input.id ? { id: input.id } : {}),
      invoiceStepId: input.invoiceStepId,
      storageProvider: input.storageProvider,
      objectKey: input.objectKey,
      originalFilename: input.originalFilename,
      sha256: input.sha256,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: input.uploadedBy,
      scanStatus: input.scanStatus ?? "pending",
    })
    .returning();
  return row!;
}
