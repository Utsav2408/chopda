/**
 * Thin server actions for company profile / banks / summary (B8-04).
 * Session is resolved from cookies server-side — never trust a client-supplied ctx.
 */
"use server";

import {
  addBank,
  addBankAccountSchema,
  deactivateBank,
  editBank,
  editBankAccountSchema,
  loadCompanyPage,
  setDefaultBank,
  update,
  updateCompanyProfileSchema,
  type BankAccountView,
  type CompanyPageData,
  type CompanyProfileView,
} from "../company/index.js";
import { requireActionSession } from "../auth/cached-session.js";
import { Validation } from "../kernel/errors.js";

async function ctxFromCookies() {
  const resolved = await requireActionSession();
  return resolved.ctx;
}

export async function companyLoadPageAction(): Promise<CompanyPageData> {
  const ctx = await ctxFromCookies();
  return loadCompanyPage(ctx);
}

export async function companyUpdateAction(raw: unknown): Promise<CompanyProfileView> {
  const parsed = updateCompanyProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid company profile payload");
  const ctx = await ctxFromCookies();
  return update(ctx, parsed.data);
}

export async function companyAddBankAction(raw: unknown): Promise<BankAccountView> {
  const parsed = addBankAccountSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid bank account payload");
  const ctx = await ctxFromCookies();
  return addBank(ctx, parsed.data);
}

export async function companyEditBankAction(id: string, raw: unknown): Promise<BankAccountView> {
  const parsed = editBankAccountSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid bank account payload");
  const ctx = await ctxFromCookies();
  return editBank(ctx, id, parsed.data);
}

export async function companyDeactivateBankAction(id: string): Promise<BankAccountView> {
  const ctx = await ctxFromCookies();
  return deactivateBank(ctx, id);
}

export async function companySetDefaultBankAction(id: string): Promise<BankAccountView> {
  const ctx = await ctxFromCookies();
  return setDefaultBank(ctx, id);
}
