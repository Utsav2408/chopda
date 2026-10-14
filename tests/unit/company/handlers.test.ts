import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  handleGetProfile,
  handleListBanks,
  handleUpdateProfile,
} from "../../../src/server/company/handlers.js";
import type { RequestContext } from "../../../src/server/db/with-user.js";

vi.mock("../../../src/server/company/service.js", () => ({
  get: vi.fn(),
  update: vi.fn(),
  listBanks: vi.fn(),
  summary: vi.fn(),
  addBank: vi.fn(),
  editBank: vi.fn(),
  deactivateBank: vi.fn(),
  setDefaultBank: vi.fn(),
}));

import * as company from "../../../src/server/company/service.js";
import { Forbidden, Unauthenticated } from "../../../src/server/kernel/errors.js";

const adminCtx: RequestContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "admin",
  requestId: "req",
};

describe("company handlers (B8-04)", () => {
  beforeEach(() => {
    vi.mocked(company.get).mockReset();
    vi.mocked(company.update).mockReset();
    vi.mocked(company.listBanks).mockReset();
  });

  it("handleGetProfile returns 200 body", async () => {
    vi.mocked(company.get).mockResolvedValue({
      legalName: "Chopda",
      gstin: null,
      pan: null,
      invoiceDefaults: {},
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const result = await handleGetProfile(adminCtx);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ legalName: "Chopda" });
  });

  it("handleUpdateProfile maps Unauthenticated to 401", async () => {
    vi.mocked(company.update).mockRejectedValue(new Unauthenticated());
    const result = await handleUpdateProfile(null, { legalName: "X" });
    expect(result.status).toBe(401);
  });

  it("handleListBanks maps Forbidden to 404", async () => {
    vi.mocked(company.listBanks).mockRejectedValue(new Forbidden());
    const result = await handleListBanks({
      userId: "22222222-2222-4222-8222-222222222222",
      role: "viewer",
      requestId: "req",
    });
    expect(result.status).toBe(404);
  });

  it("handleUpdateProfile rejects invalid body", async () => {
    const result = await handleUpdateProfile(adminCtx, { legalName: "" });
    expect(result.status).toBe(400);
  });
});
