import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/auth/request-context", () => ({
  requireAuthedRequest: vi.fn(),
}));

vi.mock("@/server/flows", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/flows/index.js")>(
    "../../../src/server/flows/index.js",
  );
  return {
    ...actual,
    list: vi.fn(),
    createDraft: vi.fn(),
    publish: vi.fn(),
  };
});

import { GET, POST } from "../../../src/app/api/flows/route.js";
import { POST as publishPost } from "../../../src/app/api/flows/[id]/publish/route.js";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { createDraft, list, publish } from "@/server/flows";
import { Unauthenticated, Forbidden } from "../../../src/server/kernel/errors.js";

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

describe("flows API routes (B4-10)", () => {
  beforeEach(() => {
    vi.mocked(requireAuthedRequest).mockReset();
    vi.mocked(list).mockReset();
    vi.mocked(createDraft).mockReset();
    vi.mocked(publish).mockReset();
  });

  it("GET /api/flows returns 401 when unauthenticated", async () => {
    vi.mocked(requireAuthedRequest).mockRejectedValue(new Unauthenticated());
    const response = await GET(new Request("http://localhost/api/flows"));
    expect(response.status).toBe(401);
  });

  it("GET /api/flows returns flows list", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(list).mockResolvedValue([
      {
        id: "f1",
        name: "Standard",
        status: "published",
        publishedVersionNo: 1,
        steps: [{ stepNumber: 1, name: "A" }],
        activeInvoiceCount: 0,
      },
    ]);

    const response = await GET(new Request("http://localhost/api/flows"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { flows: { name: string }[] };
    expect(body.flows[0]!.name).toBe("Standard");
  });

  it("POST /api/flows creates a draft", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(createDraft).mockResolvedValue({
      id: "f2",
      name: "New",
      status: "draft",
      createdBy: builderCtx.ctx.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedVersionNo: null,
      draftVersionId: "v",
      workingVersionId: "v",
      steps: [],
      activeInvoiceCount: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ name: "New" }),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { flow: { name: string } };
    expect(body.flow.name).toBe("New");
  });

  it("POST /api/flows returns 404 when viewer forbidden", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue({
      ...builderCtx,
      ctx: { ...builderCtx.ctx, role: "viewer" },
    } as never);
    vi.mocked(createDraft).mockRejectedValue(new Forbidden());

    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ name: "Nope" }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("POST /api/flows/[id]/publish succeeds", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(publish).mockResolvedValue({
      id: "f3",
      name: "Pub",
      status: "published",
      createdBy: builderCtx.ctx.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedVersionNo: 1,
      draftVersionId: null,
      workingVersionId: "v",
      steps: [],
      activeInvoiceCount: 0,
    });

    const response = await publishPost(
      new Request("http://localhost/api/flows/f3/publish", {
        method: "POST",
        headers: { origin: "http://localhost" },
      }),
      { params: Promise.resolve({ id: "f3" }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { flow: { status: string } };
    expect(body.flow.status).toBe("published");
  });
});
