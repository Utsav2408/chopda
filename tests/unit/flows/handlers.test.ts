import { describe, expect, it, vi } from "vitest";
import { Forbidden, Unauthenticated, Validation } from "../../../src/server/kernel/errors.js";
import {
  handleCreateDraft,
  handleList,
  mapErrorToHandlerResult,
} from "../../../src/server/flows/handlers.js";
import * as flows from "../../../src/server/flows/service.js";

describe("flow handlers (B4-10)", () => {
  it("mapErrorToHandlerResult maps AppError codes to HTTP status", () => {
    expect(mapErrorToHandlerResult(new Unauthenticated()).status).toBe(401);
    expect(mapErrorToHandlerResult(new Forbidden()).status).toBe(404);
    expect(mapErrorToHandlerResult(new Validation("bad")).status).toBe(400);
    expect(mapErrorToHandlerResult(new Error("boom")).status).toBe(500);
  });

  it("handleCreateDraft returns 400 on invalid body", async () => {
    const result = await handleCreateDraft(
      { userId: "u", role: "builder", requestId: "r" },
      { name: "" },
    );
    expect(result.status).toBe(400);
    expect((result.body as { code: string }).code).toBe("Validation");
  });

  it("handleCreateDraft returns 401 when signed out", async () => {
    const result = await handleCreateDraft(null, { name: "X" });
    expect(result.status).toBe(401);
  });

  it("handleList returns 401 when signed out", async () => {
    const result = await handleList(null);
    expect(result.status).toBe(401);
  });

  it("handleCreateDraft returns 201 on success (mocked service)", async () => {
    const spy = vi.spyOn(flows, "createDraft").mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Mock",
      status: "draft",
      createdBy: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedVersionNo: null,
      draftVersionId: "v",
      workingVersionId: "v",
      steps: [],
      activeInvoiceCount: 0,
    });

    const result = await handleCreateDraft(
      { userId: "u", role: "builder", requestId: "r" },
      { name: "Mock" },
    );
    expect(result.status).toBe(201);
    expect((result.body as { name: string }).name).toBe("Mock");
    spy.mockRestore();
  });
});
