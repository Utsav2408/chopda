/**
 * Client-safe mirror of createInvoiceInputSchema for form validation (U4-01).
 */
import { z } from "zod";

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
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Amount must be a non-negative rupees string with at most 2 decimals",
  );

export const createInvoiceInputSchema = z
  .object({
    invoiceNo: z.string().trim().min(1).max(64),
    partyName: z.string().trim().min(1).max(200),
    amountRupees: rupeesAmountSchema,
    issueDate: isoDateSchema,
    dueDate: isoDateSchema.optional(),
    ownerId: z.string().uuid(),
    flowId: z.string().uuid(),
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
