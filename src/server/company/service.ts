/**
 * Company profile, bank accounts, and summary (B8-01..03).
 * Every function re-checks roles via requireRole.
 */
import { audit } from "../audit/write.js";
import { requireRole } from "../authz/index.js";
import { withUser, type RequestContext } from "../db/with-user.js";
import { Conflict, NotFound, Validation } from "../kernel/errors.js";
import { decryptField, encryptField } from "../security/crypto.js";
import { list as listUsers, type VisibleUser } from "../users/service.js";
import type {
  AddBankAccountInput,
  EditBankAccountInput,
  UpdateCompanyProfileInput,
} from "./schema.js";
import {
  clearDefaultBankAccounts,
  countActiveBankAccounts,
  getBankAccountById,
  getCompanyProfile,
  insertBankAccount,
  listBankAccounts,
  setBankAccountActive,
  setBankAccountDefault,
  updateBankAccount,
  upsertCompanyProfile,
  type CompanyBankAccountRow,
  type CompanyProfileRow,
} from "./repo.js";

/** Client-safe company profile. PAN only for Admin; never ciphertext. */
export type CompanyProfileView = {
  legalName: string;
  gstin: string | null;
  /** Present only for Admin (decrypted). Omitted for others. */
  pan?: string | null;
  invoiceDefaults: Record<string, unknown>;
  updatedAt: Date;
};

/** Client-safe bank account. Plaintext fields only — never ciphertext. */
export type BankAccountView = {
  id: string;
  label: string;
  bankName: string;
  accountHolder: string;
  branch: string | null;
  accountNumber: string;
  ifsc: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanySummary = {
  admin: VisibleUser | null;
  roleCounts: {
    admin: number;
    builder: number;
    viewer: number;
  };
};

export type CompanyCryptoDeps = {
  encryptField: (plaintext: string) => string;
  decryptField: (ciphertext: string) => string;
};

/** Optional persistence hooks for unit tests (role + encryption paths). */
export type UpdateCompanyDeps = Partial<CompanyCryptoDeps> & {
  getCompanyProfile?: () => Promise<CompanyProfileRow | null>;
  upsertCompanyProfile?: (input: {
    legalName: string;
    gstin: string | null;
    panEncrypted: string | null;
    invoiceDefaults: Record<string, unknown>;
  }) => Promise<CompanyProfileRow>;
  writeAudit?: (args: {
    action: string;
    entity: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  }) => Promise<void>;
};

export type ListBanksDeps = Partial<CompanyCryptoDeps> & {
  listBankAccounts?: () => Promise<CompanyBankAccountRow[]>;
};

function defaultCrypto(): CompanyCryptoDeps {
  return {
    encryptField: (plaintext) => encryptField(plaintext),
    decryptField: (ciphertext) => decryptField(ciphertext),
  };
}

function projectProfile(
  row: CompanyProfileRow,
  viewer: RequestContext,
  crypto: CompanyCryptoDeps,
): CompanyProfileView {
  const base: CompanyProfileView = {
    legalName: row.legalName,
    gstin: row.gstin,
    invoiceDefaults: row.invoiceDefaults,
    updatedAt: row.updatedAt,
  };
  if (viewer.role !== "admin") {
    return base;
  }
  let pan: string | null = null;
  if (row.panEncrypted) {
    pan = crypto.decryptField(row.panEncrypted);
  }
  return { ...base, pan };
}

function projectBankAccount(
  row: CompanyBankAccountRow,
  crypto: CompanyCryptoDeps,
): BankAccountView {
  return {
    id: row.id,
    label: row.label,
    bankName: row.bankName,
    accountHolder: row.accountHolder,
    branch: row.branch,
    accountNumber: crypto.decryptField(row.accountNumberEncrypted),
    ifsc: crypto.decryptField(row.ifscEncrypted),
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** All authenticated roles may read; non-Admin never receives PAN. */
export async function get(
  ctx: RequestContext | null | undefined,
  deps?: Partial<CompanyCryptoDeps> & {
    getCompanyProfile?: () => Promise<CompanyProfileRow | null>;
  },
): Promise<CompanyProfileView> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  const crypto = { ...defaultCrypto(), ...deps };

  const toView = (row: CompanyProfileRow | null): CompanyProfileView => {
    if (!row) {
      return {
        legalName: "",
        gstin: null,
        invoiceDefaults: {},
        updatedAt: new Date(0),
        ...(authed.role === "admin" ? { pan: null } : {}),
      };
    }
    return projectProfile(row, authed, crypto);
  };

  if (deps?.getCompanyProfile) {
    return toView(await deps.getCompanyProfile());
  }
  return withUser(authed, async (tx) => toView(await getCompanyProfile(tx)));
}

/** Admin-only update; PAN encrypted at rest; GSTIN stored plain. */
export async function update(
  ctx: RequestContext | null | undefined,
  input: UpdateCompanyProfileInput,
  deps?: UpdateCompanyDeps,
): Promise<CompanyProfileView> {
  const authed = requireRole(ctx, "admin");
  const crypto = { ...defaultCrypto(), ...deps };

  const run = async (
    getProfile: () => Promise<CompanyProfileRow | null>,
    upsert: NonNullable<UpdateCompanyDeps["upsertCompanyProfile"]>,
    writeAudit: NonNullable<UpdateCompanyDeps["writeAudit"]>,
  ): Promise<CompanyProfileView> => {
    const existing = await getProfile();
    const legalName = input.legalName ?? existing?.legalName;
    if (!legalName || legalName.trim().length === 0) {
      throw new Validation("legalName is required");
    }

    let panEncrypted = existing?.panEncrypted ?? null;
    if (input.pan !== undefined) {
      if (input.pan === null || input.pan === "") {
        panEncrypted = null;
      } else {
        panEncrypted = crypto.encryptField(input.pan);
      }
    }

    const gstin = input.gstin !== undefined ? input.gstin : (existing?.gstin ?? null);
    const invoiceDefaults =
      input.invoiceDefaults !== undefined
        ? input.invoiceDefaults
        : (existing?.invoiceDefaults ?? {});

    const row = await upsert({
      legalName,
      gstin,
      panEncrypted,
      invoiceDefaults,
    });

    await writeAudit({
      action: "company.profile.update",
      entity: "company_profile",
      entityId: "1",
      before: existing
        ? {
            legalName: existing.legalName,
            gstin: existing.gstin,
            hasPan: Boolean(existing.panEncrypted),
            invoiceDefaults: existing.invoiceDefaults,
          }
        : null,
      after: {
        legalName: row.legalName,
        gstin: row.gstin,
        hasPan: Boolean(row.panEncrypted),
        invoiceDefaults: row.invoiceDefaults,
      },
    });

    return projectProfile(row, authed, crypto);
  };

  if (deps?.upsertCompanyProfile && deps?.getCompanyProfile) {
    return run(
      deps.getCompanyProfile,
      deps.upsertCompanyProfile,
      deps.writeAudit ?? (async () => undefined),
    );
  }

  return withUser(authed, async (tx) =>
    run(
      () => getCompanyProfile(tx),
      (values) => upsertCompanyProfile(tx, values),
      (args) =>
        audit({
          tx,
          ctx: authed,
          action: args.action,
          entity: args.entity,
          entityId: args.entityId,
          before: args.before,
          after: args.after,
        }),
    ),
  );
}

/** Builder + Admin; Viewers denied (RLS + requireRole). */
export async function listBanks(
  ctx: RequestContext | null | undefined,
  deps?: ListBanksDeps,
): Promise<BankAccountView[]> {
  const authed = requireRole(ctx, "admin", "builder");
  const crypto = { ...defaultCrypto(), ...deps };
  if (deps?.listBankAccounts) {
    const rows = await deps.listBankAccounts();
    return rows.map((row) => projectBankAccount(row, crypto));
  }
  return withUser(authed, async (tx) => {
    const rows = await listBankAccounts(tx);
    return rows.map((row) => projectBankAccount(row, crypto));
  });
}

/** Admin-only: add bank account; encrypt account number + IFSC. */
export async function addBank(
  ctx: RequestContext | null | undefined,
  input: AddBankAccountInput,
  deps?: Partial<CompanyCryptoDeps>,
): Promise<BankAccountView> {
  const authed = requireRole(ctx, "admin");
  const crypto = { ...defaultCrypto(), ...deps };
  return withUser(authed, async (tx) => {
    const activeCount = await countActiveBankAccounts(tx);
    const wantDefault = input.isDefault === true || activeCount === 0;
    if (wantDefault) {
      await clearDefaultBankAccounts(tx);
    }

    const row = await insertBankAccount(tx, {
      label: input.label,
      bankName: input.bankName,
      accountHolder: input.accountHolder,
      branch: input.branch ?? null,
      accountNumberEncrypted: crypto.encryptField(input.accountNumber),
      ifscEncrypted: crypto.encryptField(input.ifsc),
      isDefault: wantDefault,
    });

    await audit({
      tx,
      ctx: authed,
      action: "company.bank.add",
      entity: "company_bank_accounts",
      entityId: row.id,
      after: {
        label: row.label,
        bankName: row.bankName,
        isDefault: row.isDefault,
        isActive: row.isActive,
      },
    });

    return projectBankAccount(row, crypto);
  });
}

/** Admin-only: edit bank account fields. */
export async function editBank(
  ctx: RequestContext | null | undefined,
  id: string,
  input: EditBankAccountInput,
  deps?: Partial<CompanyCryptoDeps>,
): Promise<BankAccountView> {
  const authed = requireRole(ctx, "admin");
  const crypto = { ...defaultCrypto(), ...deps };
  return withUser(authed, async (tx) => {
    const existing = await getBankAccountById(tx, id);
    if (!existing) throw new NotFound();

    const patch: {
      label?: string;
      bankName?: string;
      accountHolder?: string;
      branch?: string | null;
      accountNumberEncrypted?: string;
      ifscEncrypted?: string;
    } = {};
    if (input.label !== undefined) patch.label = input.label;
    if (input.bankName !== undefined) patch.bankName = input.bankName;
    if (input.accountHolder !== undefined) patch.accountHolder = input.accountHolder;
    if (input.branch !== undefined) patch.branch = input.branch;
    if (input.accountNumber !== undefined) {
      patch.accountNumberEncrypted = crypto.encryptField(input.accountNumber);
    }
    if (input.ifsc !== undefined) {
      patch.ifscEncrypted = crypto.encryptField(input.ifsc);
    }

    const row = await updateBankAccount(tx, id, patch);
    if (!row) throw new NotFound();

    await audit({
      tx,
      ctx: authed,
      action: "company.bank.edit",
      entity: "company_bank_accounts",
      entityId: id,
      before: {
        label: existing.label,
        bankName: existing.bankName,
        isDefault: existing.isDefault,
        isActive: existing.isActive,
      },
      after: {
        label: row.label,
        bankName: row.bankName,
        isDefault: row.isDefault,
        isActive: row.isActive,
      },
    });

    return projectBankAccount(row, crypto);
  });
}

/** Admin-only: deactivate a bank account. */
export async function deactivateBank(
  ctx: RequestContext | null | undefined,
  id: string,
  deps?: Partial<CompanyCryptoDeps>,
): Promise<BankAccountView> {
  const authed = requireRole(ctx, "admin");
  const crypto = { ...defaultCrypto(), ...deps };
  return withUser(authed, async (tx) => {
    const existing = await getBankAccountById(tx, id);
    if (!existing) throw new NotFound();
    if (!existing.isActive) {
      throw new Conflict("Bank account is already inactive");
    }

    const row = await setBankAccountActive(tx, id, false);
    if (!row) throw new NotFound();

    await audit({
      tx,
      ctx: authed,
      action: "company.bank.deactivate",
      entity: "company_bank_accounts",
      entityId: id,
      before: { isActive: true, isDefault: existing.isDefault },
      after: { isActive: row.isActive, isDefault: row.isDefault },
    });

    return projectBankAccount(row, crypto);
  });
}

/** Admin-only: set the single active default bank account. */
export async function setDefaultBank(
  ctx: RequestContext | null | undefined,
  id: string,
  deps?: Partial<CompanyCryptoDeps>,
): Promise<BankAccountView> {
  const authed = requireRole(ctx, "admin");
  const crypto = { ...defaultCrypto(), ...deps };
  return withUser(authed, async (tx) => {
    const existing = await getBankAccountById(tx, id);
    if (!existing) throw new NotFound();
    if (!existing.isActive) {
      throw new Validation("Cannot set an inactive bank account as default");
    }

    const row = await setBankAccountDefault(tx, id);
    if (!row) throw new NotFound();

    await audit({
      tx,
      ctx: authed,
      action: "company.bank.setDefault",
      entity: "company_bank_accounts",
      entityId: id,
      after: { isDefault: true, isActive: true },
    });

    return projectBankAccount(row, crypto);
  });
}

/**
 * Current Admin + role counts (B8-03).
 * Uses users.list for counts so contact visibility matches list rules.
 */
export async function summary(ctx: RequestContext | null | undefined): Promise<CompanySummary> {
  requireRole(ctx, "admin", "builder", "viewer");
  const users = await listUsers(ctx);
  const roleCounts = { admin: 0, builder: 0, viewer: 0 };
  let admin: VisibleUser | null = null;
  for (const user of users) {
    if (user.role === "admin") {
      roleCounts.admin += 1;
      if (user.isActive) admin = user;
    } else if (user.role === "builder") {
      roleCounts.builder += 1;
    } else if (user.role === "viewer") {
      roleCounts.viewer += 1;
    }
  }
  return { admin, roleCounts };
}
