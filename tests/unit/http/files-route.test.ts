import { describe, expect, it, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("@/server/auth/request-context", () => ({
  requireAuthedRequest: vi.fn(),
}));

vi.mock("@/server/documents", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/documents/index.js")>(
    "../../../src/server/documents/index.js",
  );
  return {
    ...actual,
    download: vi.fn(),
    upload: vi.fn(),
  };
});

import { GET } from "../../../src/app/api/files/[id]/route.js";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { download } from "@/server/documents";
import { Unauthenticated, NotFound } from "../../../src/server/kernel/errors.js";

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

describe("files API routes (B6-07)", () => {
  beforeEach(() => {
    vi.mocked(requireAuthedRequest).mockReset();
    vi.mocked(download).mockReset();
  });

  it("GET /api/files/[id] returns 401 when unauthenticated", async () => {
    vi.mocked(requireAuthedRequest).mockRejectedValue(new Unauthenticated());
    const response = await GET(new Request("http://localhost/api/files/x"), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/files/[id] streams with security headers", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(download).mockResolvedValue({
      stream: Readable.from([Buffer.from("%PDF-1.4")]),
      mimeType: "application/pdf",
      filename: "invoice.pdf",
      sizeBytes: 8,
      cacheControl: "private, max-age=31536000, immutable",
    });

    const response = await GET(new Request("http://localhost/api/files/x"), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(response.headers.get("Content-Disposition")).toContain("invoice.pdf");
  });

  it("GET /api/files/[id] maps NotFound to 404", async () => {
    vi.mocked(requireAuthedRequest).mockResolvedValue(builderCtx as never);
    vi.mocked(download).mockRejectedValue(new NotFound());
    const response = await GET(new Request("http://localhost/api/files/x"), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(404);
  });
});
