import { describe, expect, it } from "vitest";
import {
  completeStepInputSchema,
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
} from "../../../src/server/invoices/schema.js";

const validCreate = {
  invoiceNo: "INV-001",
  partyName: "Acme Traders",
  amountRupees: "1250.50",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  ownerId: "11111111-1111-4111-8111-111111111111",
  flowId: "22222222-2222-4222-8222-222222222222",
};

describe("invoice schemas (B5-02)", () => {
  it("accepts a valid create payload", () => {
    const parsed = createInvoiceInputSchema.parse(validCreate);
    expect(parsed.invoiceNo).toBe("INV-001");
    expect(parsed.amountRupees).toBe("1250.50");
  });

  it("rejects amount with >2 decimals", () => {
    expect(() =>
      createInvoiceInputSchema.parse({ ...validCreate, amountRupees: "1.001" }),
    ).toThrow();
  });

  it("rejects dueDate before issueDate", () => {
    expect(() =>
      createInvoiceInputSchema.parse({
        ...validCreate,
        issueDate: "2026-10-10",
        dueDate: "2026-10-01",
      }),
    ).toThrow();
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      createInvoiceInputSchema.parse({ ...validCreate, issueDate: "2026-02-30" }),
    ).toThrow();
  });

  it("update schema is strict and refuses empty patches", () => {
    expect(() => updateInvoiceInputSchema.parse({})).toThrow();
    expect(() => updateInvoiceInputSchema.parse({ flowId: validCreate.flowId })).toThrow();
    expect(updateInvoiceInputSchema.parse({ partyName: "New" }).partyName).toBe("New");
  });

  it("complete step schema requires uuids and object data", () => {
    const parsed = completeStepInputSchema.parse({
      invoiceId: validCreate.ownerId,
      invoiceStepId: validCreate.flowId,
      data: { raised: true },
    });
    expect(parsed.data.raised).toBe(true);
  });
});
