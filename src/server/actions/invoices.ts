/**
 * Thin server actions for invoices, steps, dashboard, history, reminders (B5-09 / B7-12).
 */
"use server";

import { requireActionSession } from "../auth/cached-session.js";
import {
  completeStepInputSchema,
  create,
  createInvoiceInputSchema,
  list,
  listDeleted,
  listInvoicesQuerySchema,
  loadInvoiceDetailPage,
  softDelete,
  undo,
  type InvoiceDetail,
  type InvoiceDetailPage,
  type InvoiceListResult,
  type DeletedInvoiceListItem,
} from "../invoices/index.js";
import { complete } from "../steps/index.js";
import * as dashboard from "../dashboard/index.js";
import * as reminders from "../reminders/index.js";
import { Validation } from "../kernel/errors.js";

async function ctxFromCookies() {
  const resolved = await requireActionSession();
  return resolved.ctx;
}

export async function invoicesCreateAction(raw: unknown): Promise<InvoiceDetail> {
  const parsed = createInvoiceInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid create invoice payload");
  const ctx = await ctxFromCookies();
  return create(ctx, parsed.data);
}

/** Invoice detail + history + display names in one transaction. */
export async function invoicesDetailPageAction(invoiceId: string): Promise<InvoiceDetailPage> {
  const ctx = await ctxFromCookies();
  return loadInvoiceDetailPage(ctx, invoiceId);
}

export async function invoicesListAction(raw: unknown): Promise<InvoiceListResult> {
  const parsed = listInvoicesQuerySchema.safeParse(raw ?? {});
  if (!parsed.success) throw new Validation("Invalid list query");
  const ctx = await ctxFromCookies();
  return list(ctx, parsed.data);
}

export async function invoicesSoftDeleteAction(
  invoiceId: string,
): Promise<{ id: string; deletedAt: Date }> {
  const ctx = await ctxFromCookies();
  return softDelete(ctx, invoiceId);
}

export async function invoicesUndoAction(invoiceId: string): Promise<{ id: string }> {
  const ctx = await ctxFromCookies();
  return undo(ctx, invoiceId);
}

export async function invoicesListDeletedAction(): Promise<DeletedInvoiceListItem[]> {
  const ctx = await ctxFromCookies();
  return listDeleted(ctx);
}

export async function stepsCompleteAction(raw: unknown): Promise<InvoiceDetail> {
  const parsed = completeStepInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid complete step payload");
  const ctx = await ctxFromCookies();
  return complete(ctx, parsed.data);
}

/** Single-txn dashboard bundle (counts + byStep + attention + activity + names). */
export async function dashboardLoadAction() {
  const ctx = await ctxFromCookies();
  return dashboard.loadDashboard(ctx);
}

export async function remindersComputeAction() {
  const ctx = await ctxFromCookies();
  return reminders.compute(ctx);
}

export async function remindersDismissAction(key: string) {
  const ctx = await ctxFromCookies();
  await reminders.dismiss(ctx, key);
  return { ok: true as const };
}
