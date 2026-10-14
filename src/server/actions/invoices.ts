/**
 * Thin server actions for invoices + steps (B5-09).
 * Session is resolved from cookies server-side — never trust a client-supplied ctx.
 * List / soft-delete / dashboard actions land with B7.
 */
"use server";

import { cookies } from "next/headers";
import {
  create,
  createInvoiceInputSchema,
  get,
  update,
  updateInvoiceInputSchema,
  type InvoiceDetail,
} from "../invoices/index.js";
import { completeStepInputSchema } from "../invoices/schema.js";
import { complete } from "../steps/index.js";
import { resolveSession } from "../auth/index.js";
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

export async function stepsCompleteAction(raw: unknown): Promise<InvoiceDetail> {
  const parsed = completeStepInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid complete step payload");
  const ctx = await ctxFromCookies();
  return complete(ctx, parsed.data);
}
