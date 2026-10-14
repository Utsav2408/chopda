/**
 * Thin server actions for invoices, steps, dashboard, history, reminders (B5-09 / B7-12).
 */
"use server";

import { cookies } from "next/headers";
import { resolveSession } from "../auth/index.js";
import {
  completeStepInputSchema,
  create,
  createInvoiceInputSchema,
  get,
  list,
  listDeleted,
  listInvoicesQuerySchema,
  softDelete,
  undo,
  update,
  updateInvoiceInputSchema,
  type InvoiceDetail,
  type InvoiceListResult,
  type DeletedInvoiceListItem,
} from "../invoices/index.js";
import { complete } from "../steps/index.js";
import * as dashboard from "../dashboard/index.js";
import * as history from "../history/index.js";
import * as reminders from "../reminders/index.js";
import { SESSION_COOKIE_NAME } from "../security/constants.js";
import { Unauthenticated, Validation } from "../kernel/errors.js";

async function ctxFromCookies() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const resolved = await resolveSession(token);
  if (!resolved) {
    throw new Unauthenticated();
  }
  return resolved.ctx;
}

export async function invoicesCreateAction(raw: unknown): Promise<InvoiceDetail> {
  const parsed = createInvoiceInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid create invoice payload");
  const ctx = await ctxFromCookies();
  return create(ctx, parsed.data);
}

export async function invoicesUpdateAction(
  invoiceId: string,
  raw: unknown,
): Promise<InvoiceDetail> {
  const parsed = updateInvoiceInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid update invoice payload");
  const ctx = await ctxFromCookies();
  return update(ctx, invoiceId, parsed.data);
}

export async function invoicesGetAction(invoiceId: string): Promise<InvoiceDetail> {
  const ctx = await ctxFromCookies();
  return get(ctx, invoiceId);
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

export async function dashboardCountsAction() {
  const ctx = await ctxFromCookies();
  return dashboard.counts(ctx);
}

export async function dashboardByStepAction() {
  const ctx = await ctxFromCookies();
  return dashboard.byStep(ctx);
}

export async function dashboardNeedsAttentionAction() {
  const ctx = await ctxFromCookies();
  return dashboard.needsAttention(ctx);
}

export async function dashboardRecentActivityAction() {
  const ctx = await ctxFromCookies();
  return dashboard.recentActivity(ctx);
}

export async function invoiceHistoryAction(invoiceId: string) {
  const ctx = await ctxFromCookies();
  return history.forInvoice(ctx, invoiceId);
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
