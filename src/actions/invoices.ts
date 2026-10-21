/**
 * UI-facing invoice / dashboard / history / reminder actions (U4).
 * Thin wrappers for client-safe imports (Turbopack rejects barrel re-exports
 * under `"use server"`).
 */
"use server";

import {
  invoicesCreateAction as createInvoice,
  invoicesDetailPageAction as getInvoiceDetailPage,
  invoicesListAction as listInvoices,
  invoicesSoftDeleteAction as softDeleteInvoice,
  invoicesUndoAction as undoInvoice,
  invoicesListDeletedAction as listDeletedInvoices,
  stepsCompleteAction as completeStep,
  dashboardLoadAction as dashLoad,
  remindersComputeAction as computeReminders,
  remindersDismissAction as dismissReminder,
} from "../server/actions/invoices.js";

export async function invoicesCreateAction(raw: unknown) {
  return createInvoice(raw);
}

export async function invoicesDetailPageAction(id: string) {
  return getInvoiceDetailPage(id);
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

export async function dashboardLoadAction() {
  return dashLoad();
}

export async function remindersComputeAction() {
  return computeReminders();
}

export async function remindersDismissAction(key: string) {
  return dismissReminder(key);
}
