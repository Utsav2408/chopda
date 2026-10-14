/**
 * Company profile + bank accounts persistence (B8-01..02).
 * Encrypted columns stay in this layer / service only — never in client DTOs.
 */
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { companyBankAccounts, companyProfile } from "../db/schema.js";
import type { AppTx } from "../db/client.js";

/** Internal profile row including ciphertext (service decrypts / strips). */
export type CompanyProfileRow = {
  id: number;
  legalName: string;
  gstin: string | null;
  panEncrypted: string | null;
  invoiceDefaults: Record<string, unknown>;
  updatedAt: Date;
};

/** Internal bank row including ciphertext (service decrypts). */
export type CompanyBankAccountRow = {
  id: string;
  label: string;
  bankName: string;
  accountHolder: string;
  branch: string | null;
  accountNumberEncrypted: string;
  ifscEncrypted: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function asInvoiceDefaults(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function getCompanyProfile(tx: AppTx): Promise<CompanyProfileRow | null> {
  const [row] = await tx
    .select({
      id: companyProfile.id,
      legalName: companyProfile.legalName,
      gstin: companyProfile.gstin,
      panEncrypted: companyProfile.panEncrypted,
      invoiceDefaults: companyProfile.invoiceDefaults,
      updatedAt: companyProfile.updatedAt,
    })
    .from(companyProfile)
    .where(eq(companyProfile.id, 1))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    invoiceDefaults: asInvoiceDefaults(row.invoiceDefaults),
  };
}

export async function upsertCompanyProfile(
  tx: AppTx,
  input: {
    legalName: string;
    gstin: string | null;
    panEncrypted: string | null;
    invoiceDefaults: Record<string, unknown>;
  },
): Promise<CompanyProfileRow> {
  const now = new Date();
  const [row] = await tx
    .insert(companyProfile)
    .values({
      id: 1,
      legalName: input.legalName,
      gstin: input.gstin,
      panEncrypted: input.panEncrypted,
      invoiceDefaults: input.invoiceDefaults,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: companyProfile.id,
      set: {
        legalName: input.legalName,
        gstin: input.gstin,
        panEncrypted: input.panEncrypted,
        invoiceDefaults: input.invoiceDefaults,
        updatedAt: now,
      },
    })
    .returning({
      id: companyProfile.id,
      legalName: companyProfile.legalName,
      gstin: companyProfile.gstin,
      panEncrypted: companyProfile.panEncrypted,
      invoiceDefaults: companyProfile.invoiceDefaults,
      updatedAt: companyProfile.updatedAt,
    });
  if (!row) {
    throw new Error("Failed to upsert company profile");
  }
  return {
    ...row,
    invoiceDefaults: asInvoiceDefaults(row.invoiceDefaults),
  };
}

export async function listBankAccounts(tx: AppTx): Promise<CompanyBankAccountRow[]> {
  const rows = await tx
    .select({
      id: companyBankAccounts.id,
      label: companyBankAccounts.label,
      bankName: companyBankAccounts.bankName,
      accountHolder: companyBankAccounts.accountHolder,
      branch: companyBankAccounts.branch,
      accountNumberEncrypted: companyBankAccounts.accountNumberEncrypted,
      ifscEncrypted: companyBankAccounts.ifscEncrypted,
      isDefault: companyBankAccounts.isDefault,
      isActive: companyBankAccounts.isActive,
      createdAt: companyBankAccounts.createdAt,
      updatedAt: companyBankAccounts.updatedAt,
    })
    .from(companyBankAccounts)
    .orderBy(asc(companyBankAccounts.createdAt));
  return rows;
}

export async function getBankAccountById(
  tx: AppTx,
  id: string,
): Promise<CompanyBankAccountRow | null> {
  const [row] = await tx
    .select({
      id: companyBankAccounts.id,
      label: companyBankAccounts.label,
      bankName: companyBankAccounts.bankName,
      accountHolder: companyBankAccounts.accountHolder,
      branch: companyBankAccounts.branch,
      accountNumberEncrypted: companyBankAccounts.accountNumberEncrypted,
      ifscEncrypted: companyBankAccounts.ifscEncrypted,
      isDefault: companyBankAccounts.isDefault,
      isActive: companyBankAccounts.isActive,
      createdAt: companyBankAccounts.createdAt,
      updatedAt: companyBankAccounts.updatedAt,
    })
    .from(companyBankAccounts)
    .where(eq(companyBankAccounts.id, id))
    .limit(1);
  return row ?? null;
}

export async function clearDefaultBankAccounts(tx: AppTx, exceptId?: string): Promise<void> {
  if (exceptId) {
    await tx
      .update(companyBankAccounts)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(companyBankAccounts.isDefault, true), ne(companyBankAccounts.id, exceptId)));
    return;
  }
  await tx
    .update(companyBankAccounts)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(companyBankAccounts.isDefault, true));
}

export async function insertBankAccount(
  tx: AppTx,
  input: {
    label: string;
    bankName: string;
    accountHolder: string;
    branch: string | null;
    accountNumberEncrypted: string;
    ifscEncrypted: string;
    isDefault: boolean;
  },
): Promise<CompanyBankAccountRow> {
  const [row] = await tx
    .insert(companyBankAccounts)
    .values({
      label: input.label,
      bankName: input.bankName,
      accountHolder: input.accountHolder,
      branch: input.branch,
      accountNumberEncrypted: input.accountNumberEncrypted,
      ifscEncrypted: input.ifscEncrypted,
      isDefault: input.isDefault,
      isActive: true,
    })
    .returning({
      id: companyBankAccounts.id,
      label: companyBankAccounts.label,
      bankName: companyBankAccounts.bankName,
      accountHolder: companyBankAccounts.accountHolder,
      branch: companyBankAccounts.branch,
      accountNumberEncrypted: companyBankAccounts.accountNumberEncrypted,
      ifscEncrypted: companyBankAccounts.ifscEncrypted,
      isDefault: companyBankAccounts.isDefault,
      isActive: companyBankAccounts.isActive,
      createdAt: companyBankAccounts.createdAt,
      updatedAt: companyBankAccounts.updatedAt,
    });
  if (!row) {
    throw new Error("Failed to insert bank account");
  }
  return row;
}

export async function updateBankAccount(
  tx: AppTx,
  id: string,
  patch: {
    label?: string;
    bankName?: string;
    accountHolder?: string;
    branch?: string | null;
    accountNumberEncrypted?: string;
    ifscEncrypted?: string;
  },
): Promise<CompanyBankAccountRow | null> {
  const [row] = await tx
    .update(companyBankAccounts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(companyBankAccounts.id, id))
    .returning({
      id: companyBankAccounts.id,
      label: companyBankAccounts.label,
      bankName: companyBankAccounts.bankName,
      accountHolder: companyBankAccounts.accountHolder,
      branch: companyBankAccounts.branch,
      accountNumberEncrypted: companyBankAccounts.accountNumberEncrypted,
      ifscEncrypted: companyBankAccounts.ifscEncrypted,
      isDefault: companyBankAccounts.isDefault,
      isActive: companyBankAccounts.isActive,
      createdAt: companyBankAccounts.createdAt,
      updatedAt: companyBankAccounts.updatedAt,
    });
  return row ?? null;
}

export async function setBankAccountActive(
  tx: AppTx,
  id: string,
  isActive: boolean,
): Promise<CompanyBankAccountRow | null> {
  // Deactivating a default clears the default bit so another can be set.
  const patch = isActive
    ? { isActive: true, updatedAt: new Date() }
    : { isActive: false, isDefault: false, updatedAt: new Date() };
  const [row] = await tx
    .update(companyBankAccounts)
    .set(patch)
    .where(eq(companyBankAccounts.id, id))
    .returning({
      id: companyBankAccounts.id,
      label: companyBankAccounts.label,
      bankName: companyBankAccounts.bankName,
      accountHolder: companyBankAccounts.accountHolder,
      branch: companyBankAccounts.branch,
      accountNumberEncrypted: companyBankAccounts.accountNumberEncrypted,
      ifscEncrypted: companyBankAccounts.ifscEncrypted,
      isDefault: companyBankAccounts.isDefault,
      isActive: companyBankAccounts.isActive,
      createdAt: companyBankAccounts.createdAt,
      updatedAt: companyBankAccounts.updatedAt,
    });
  return row ?? null;
}

export async function setBankAccountDefault(
  tx: AppTx,
  id: string,
): Promise<CompanyBankAccountRow | null> {
  await clearDefaultBankAccounts(tx, id);
  const [row] = await tx
    .update(companyBankAccounts)
    .set({ isDefault: true, isActive: true, updatedAt: new Date() })
    .where(eq(companyBankAccounts.id, id))
    .returning({
      id: companyBankAccounts.id,
      label: companyBankAccounts.label,
      bankName: companyBankAccounts.bankName,
      accountHolder: companyBankAccounts.accountHolder,
      branch: companyBankAccounts.branch,
      accountNumberEncrypted: companyBankAccounts.accountNumberEncrypted,
      ifscEncrypted: companyBankAccounts.ifscEncrypted,
      isDefault: companyBankAccounts.isDefault,
      isActive: companyBankAccounts.isActive,
      createdAt: companyBankAccounts.createdAt,
      updatedAt: companyBankAccounts.updatedAt,
    });
  return row ?? null;
}

export async function countActiveBankAccounts(tx: AppTx): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(companyBankAccounts)
    .where(eq(companyBankAccounts.isActive, true));
  return row?.count ?? 0;
}
