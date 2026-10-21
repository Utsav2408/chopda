/**
 * UI-facing company actions (U5-02). Thin wrappers for client-safe imports.
 */
"use server";

import {
  companyLoadPageAction as loadCompanyPage,
  companyUpdateAction as updateCompany,
  companyAddBankAction as addBank,
  companyEditBankAction as editBank,
  companyDeactivateBankAction as deactivateBank,
  companySetDefaultBankAction as setDefaultBank,
} from "../server/actions/company.js";

export async function companyLoadPageAction() {
  return loadCompanyPage();
}

export async function companyUpdateAction(raw: unknown) {
  return updateCompany(raw);
}

export async function companyAddBankAction(raw: unknown) {
  return addBank(raw);
}

export async function companyEditBankAction(id: string, raw: unknown) {
  return editBank(id, raw);
}

export async function companyDeactivateBankAction(id: string) {
  return deactivateBank(id);
}

export async function companySetDefaultBankAction(id: string) {
  return setDefaultBank(id);
}
