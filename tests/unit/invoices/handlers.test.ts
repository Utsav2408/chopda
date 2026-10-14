import { describe, expect, it, vi } from "vitest";
import { Unauthenticated, Validation } from "../../../src/server/kernel/errors.js";
import {
  handleCreateInvoice,
  handleGetInvoice,
  mapErrorToHandlerResult,
} from "../../../src/server/invoices/handlers.js";
import * as invoices from "../../../src/server/invoices/service.js";

describe("invoice handlers (B5-09)", () => {
  it("mapErrorToHandlerResult maps codes", () => {
    expect(mapErrorToHandlerResult(new Unauthenticated()).status).toBe(401);
    expect(mapErrorToHandlerResult(new Validation("x")).status).toBe(400);
  });

  it("handleCreateInvoice returns 400 on invalid body", async () => {
    const result = await handleCreateInvoice(
      { userId: "u", role: "builder", requestId: "r" },
      { invoiceNo: "" },
    );
    expect(result.status).toBe(400);
  });

  it("handleCreateInvoice returns 401 when signed out", async () => {
    const result = await handleCreateInvoice(null, {
      invoiceNo: "INV-1",
      partyName: "Acme",
      amountRupees: "10.00",
      issueDate: "2026-10-01",
      ownerId: "11111111-1111-4111-8111-111111111111",
      flowId: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.status).toBe(401);
  });

  it("handleGetInvoice returns 401 when signed out", async () => {
    const result = await handleGetInvoice(null, "11111111-1111-4111-8111-111111111111");
    expect(result.status).toBe(401);
  });

  it("handleCreateInvoice returns 201 on success (mocked)", async () => {
    const spy = vi.spyOn(invoices, "create").mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      invoiceNo: "INV-1",
      flowVersionId: "v",
      flowTemplateId: "f",
      currentStepId: "s",
      status: "open",
      storedStatus: "open",
      partyName: "Acme",
      amountMinor: "1000",
      amountRupees: "10.00",
      currency: "INR",
      issueDate: "2026-10-01",
      dueDate: null,
      ownerId: "u",
      extra: {},
      createdBy: "u",
      createdAt: new Date(),
      deletedAt: null,
      steps: [],
    });

    const result = await handleCreateInvoice(
      { userId: "u", role: "builder", requestId: "r" },
      {
        invoiceNo: "INV-1",
        partyName: "Acme",
        amountRupees: "10.00",
        issueDate: "2026-10-01",
        ownerId: "11111111-1111-4111-8111-111111111111",
        flowId: "22222222-2222-4222-8222-222222222222",
      },
    );
    expect(result.status).toBe(201);
    spy.mockRestore();
  });
});
