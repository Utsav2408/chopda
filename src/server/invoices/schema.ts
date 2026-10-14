/**
 * Zod schemas for invoice create/update (B5-02).
 * Amounts are rupees strings on the wire; services convert to paise bigint.
 */
import { z } from "zod";
import { isValidRupeesString } from "../money/money.js";

export const MAX_INVOICE_NO_LENGTH = 64;
export const MAX_PARTY_NAME_LENGTH = 200;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
  }, "Must be a valid calendar date");

const rupeesAmountSchema = z
  .string()
  .min(1)
  .refine(
    isValidRupeesString,
    "Amount must be a non-negative rupees string with at most 2 decimals",
  );

export const createInvoiceInputSchema = z
  .object({
    invoiceNo: z.string().trim().min(1).max(MAX_INVOICE_NO_LENGTH),
    partyName: z.string().trim().min(1).max(MAX_PARTY_NAME_LENGTH),
    /** Rupees decimal string — converted to paise in the service. */
    amountRupees: rupeesAmountSchema,
    issueDate: isoDateSchema,
    dueDate: isoDateSchema.nullable().optional(),
    ownerId: z.string().uuid(),
    /** Flow template id — service pins the latest published version. */
    flowId: z.string().uuid(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dueDate && data.dueDate < data.issueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "dueDate must be on or after issueDate",
      });
    }
  });

export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;

/**
 * Updateable non-flow fields only. `flowId` / `flowVersionId` are intentionally
 * absent — flow version is immutable after create (B5-04).
 */
export const updateInvoiceInputSchema = z
  .object({
    invoiceNo: z.string().trim().min(1).max(MAX_INVOICE_NO_LENGTH).optional(),
    partyName: z.string().trim().min(1).max(MAX_PARTY_NAME_LENGTH).optional(),
    amountRupees: rupeesAmountSchema.optional(),
    issueDate: isoDateSchema.optional(),
    dueDate: isoDateSchema.nullable().optional(),
    ownerId: z.string().uuid().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["cancelled"]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({ code: "custom", message: "At least one field is required" });
    }
  });

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>;

export const completeStepInputSchema = z.object({
  invoiceId: z.string().uuid(),
  /** invoice_steps row id (not flow_steps id). */
  invoiceStepId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type CompleteStepInput = z.infer<typeof completeStepInputSchema>;

export const listInvoicesQuerySchema = z.object({
  tab: z.enum(["all", "mine", "waiting", "overdue", "completed"]).default("all"),
  flowId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  issueDateFrom: isoDateSchema.optional(),
  issueDateTo: isoDateSchema.optional(),
  sort: z
    .enum(["createdAt", "issueDate", "dueDate", "invoiceNo", "partyName"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
