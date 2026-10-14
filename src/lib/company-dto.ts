/** Client-safe company shapes (U5-02). Dates may be ISO strings after serialization. */

export type ClientCompanyProfile = {
  legalName: string;
  gstin: string | null;
  pan?: string | null;
  invoiceDefaults: Record<string, unknown>;
  updatedAt: string | Date;
};

export type ClientBankAccount = {
  id: string;
  label: string;
  bankName: string;
  accountHolder: string;
  branch: string | null;
  accountNumber: string;
  ifsc: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ClientCompanySummary = {
  admin: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  } | null;
  roleCounts: {
    admin: number;
    builder: number;
    viewer: number;
  };
};
