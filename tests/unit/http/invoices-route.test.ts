import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/auth/request-context", () => ({
  requireAuthedRequest: vi.fn(),
}));

vi.mock("@/server/invoices", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/invoices/index.js")>(
    "../../../src/server/invoices/index.js",
  );
  return {
    ...actual,
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  };
});

vi.mock("@/server/steps", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/steps/index.js")>(
    "../../../src/server/steps/index.js",
  );
  return {
    ...actual,
    complete: vi.fn(),
  };
});

import { POST } from "../../../src/app/api/invoices/route.js";
import { GET, PATCH } from "../../../src/app/api/invoices/[id]/route.js";
import { POST as completePost } from "../../../src/app/api/invoices/[id]/steps/complete/route.js";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { create, get, update } from "@/server/invoices";
import { complete } from "@/server/steps";
import { Unauthenticated } from "../../../src/server/kernel/errors.js";

const builderCtx = {
  ctx: {
    userId: "11111111-1111-4111-8111-111111111111",
    role: "builder" as const,
    requestId: "req-test",
  },
  token: "tok",
  requestId: "req-test",
  session: { id: "s" },
  user: { id: "11111111-1111-4111-8111-111111111111", role: "builder" },
};

const sampleInvoice = {
  id: "33333333-3333-4333-8333-333333333333",
  invoiceNo: "INV-1",
  flowVersionId: "v",
  flowTemplateId: "f",
  currentStepId: "s",
  status: "open" as const,
  storedStatus: "open",
  partyName: "Acme",
  amountMinor: "1000",
  amountRupees: "10.00",
  currency: "INR",
  issueDate: "2026-10-01",
  dueDate: null,
  ownerId: builderCtx.ctx.userId,
  extra: {},
  createdBy: builderCtx.ctx.userId,
  createdAt: new Date(),
  deletedAt: null,
  steps: [],
};

describe("invoices API routes (B5-09)", () => {
  beforeEach(() => {
    vi.mocked(requireAuthedRequest).mockReset();
    vi.mocked(create).mockReset();
    vi.mocked(get).mockReset();
    vi.mocked(update).mockReset();
    vi.mocked(complete).mockReset();
  });

  it("POST /api/invoices returns 401 when unauthenticated", async () => {
    vi.mocked(requireAuthedRequest).mockRejectedValue(new Unauthenticated());
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("POST /api/invoices creates an invoice", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(create).mockResolvedValue(sampleInvoice);

    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          invoiceNo: "INV-1",
          partyName: "Acme",
          amountRupees: "10.00",
          issueDate: "2026-10-01",
          ownerId: builderCtx.ctx.userId,
          flowId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { invoice: { invoiceNo: string } };
    expect(body.invoice.invoiceNo).toBe("INV-1");
  });

  it("GET /api/invoices/[id] returns detail", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(get).mockResolvedValue(sampleInvoice);

    const response = await GET(new Request("http://localhost/api/invoices/x"), {
      params: Promise.resolve({ id: sampleInvoice.id }),
    });
    expect(response.status).toBe(200);
  });

  it("PATCH /api/invoices/[id] updates", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(update).mockResolvedValue({ ...sampleInvoice, partyName: "New" });

    const response = await PATCH(
      new Request("http://localhost/api/invoices/x", {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ partyName: "New" }),
      }),
      { params: Promise.resolve({ id: sampleInvoice.id }) },
    );
    expect(response.status).toBe(200);
  });

  it("POST complete step", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(complete).mockResolvedValue(sampleInvoice);

    const response = await completePost(
      new Request("http://localhost/api/invoices/x/steps/complete", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          invoiceStepId: "44444444-4444-4444-8444-444444444444",
          data: { raised: true },
        }),
      }),
      { params: Promise.resolve({ id: sampleInvoice.id }) },
    );
    expect(response.status).toBe(200);
  });
});
