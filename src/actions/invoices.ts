/**
 * UI-facing invoice / dashboard / history / reminder actions (U4).
 * Thin wrappers for client-safe imports (Turbopack rejects barrel re-exports
 * under `"use server"`).
 */
"use server";

import {
  invoicesCreateAction as createInvoice,
  invoicesUpdateAction as updateInvoice,
  invoicesGetAction as getInvoice,
  invoicesListAction as listInvoices,
  invoicesSoftDeleteAction as softDeleteInvoice,
  invoicesUndoAction as undoInvoice,
  invoicesListDeletedAction as listDeletedInvoices,
  stepsCompleteAction as completeStep,
  dashboardCountsAction as dashCounts,
  dashboardByStepAction as dashByStep,
  dashboardNeedsAttentionAction as dashNeedsAttention,
  dashboardRecentActivityAction as dashRecent,
  invoiceHistoryAction as invoiceHistory,
  remindersComputeAction as computeReminders,
  remindersDismissAction as dismissReminder,
} from "../server/actions/invoices.js";

export async function invoicesCreateAction(raw: unknown) {
  return createInvoice(raw);
}

export async function invoicesUpdateAction(id: string, raw: unknown) {
  return updateInvoice(id, raw);
}

export async function invoicesGetAction(id: string) {
  return getInvoice(id);
}

export async function invoicesListAction(raw: unknown = {}) {
  return listInvoices(raw);
}

export async function invoicesSoftDeleteAction(id: string) {
  return softDeleteInvoice(id);
}

export async function invoicesUndoAction(id: string) {
  return undoInvoice(id);
}

export async function invoicesListDeletedAction() {
  return listDeletedInvoices();
}

export async function stepsCompleteAction(raw: unknown) {
  return completeStep(raw);
}

export async function dashboardCountsAction() {
  return dashCounts();
}

export async function dashboardByStepAction() {
  return dashByStep();
}

export async function dashboardNeedsAttentionAction() {
  return dashNeedsAttention();
}

export async function dashboardRecentActivityAction() {
  return dashRecent();
}

export async function invoiceHistoryAction(invoiceId: string) {
  return invoiceHistory(invoiceId);
}

export async function remindersComputeAction() {
  return computeReminders();
}

export async function remindersDismissAction(key: string) {
  return dismissReminder(key);
}
