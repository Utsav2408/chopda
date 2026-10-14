/**
 * Zod schemas for company profile and bank accounts (B8-01..02).
 */
import { z } from "zod";

/** IFSC: 4 letters, then 0, then 6 alphanumeric (DECISIONS.md). */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Optional Indian PAN (5 letters, 4 digits, 1 letter). Empty clears. */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const ifscSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => IFSC_REGEX.test(s), {
    message: "IFSC must be 4 letters, 0, then 6 letters or digits",
  });

export const panSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => s.length === 0 || PAN_REGEX.test(s), {
    message: "PAN must be 5 letters, 4 digits, then 1 letter",
  });

export const updateCompanyProfileSchema = z.object({
  legalName: z.string().trim().min(1).max(200).optional(),
  gstin: z.string().trim().max(15).nullable().optional(),
  /** Plain PAN; encrypted at rest. Null/empty clears. Omit to leave unchanged. */
  pan: panSchema.nullable().optional(),
  invoiceDefaults: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;

export const addBankAccountSchema = z.object({
  label: z.string().trim().min(1).max(120),
  bankName: z.string().trim().min(1).max(120),
  accountHolder: z.string().trim().min(1).max(120),
  branch: z.string().trim().max(200).nullable().optional(),
  accountNumber: z.string().trim().min(1).max(40),
  ifsc: ifscSchema,
  isDefault: z.boolean().optional(),
});

export type AddBankAccountInput = z.infer<typeof addBankAccountSchema>;

export const editBankAccountSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  bankName: z.string().trim().min(1).max(120).optional(),
  accountHolder: z.string().trim().min(1).max(120).optional(),
  branch: z.string().trim().max(200).nullable().optional(),
  accountNumber: z.string().trim().min(1).max(40).optional(),
  ifsc: ifscSchema.optional(),
});

export type EditBankAccountInput = z.infer<typeof editBankAccountSchema>;
