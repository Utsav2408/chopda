import { describe, expect, it } from "vitest";
import { canSeeInvoice, requireRole, requireStepRole } from "../../../src/server/authz/index.js";
import type { RequestContext } from "../../../src/server/db/with-user.js";
import { Forbidden, Unauthenticated } from "../../../src/server/kernel/errors.js";

function ctx(role: RequestContext["role"]): RequestContext {
  return {
    userId: "33333333-3333-4333-8333-333333333333",
    role,
    requestId: "req-test",
  };
}

describe("authz helpers (B2-08)", () => {
  describe("requireRole", () => {
    it("signed-out throws Unauthenticated", () => {
      expect(() => requireRole(null, "admin")).toThrow(Unauthenticated);
    });

    it("viewer denied for admin-only", () => {
      expect(() => requireRole(ctx("viewer"), "admin")).toThrow(Forbidden);
    });

    it("builder denied for admin-only", () => {
      expect(() => requireRole(ctx("builder"), "admin")).toThrow(Forbidden);
    });

    it("admin allowed for admin-only", () => {
      expect(requireRole(ctx("admin"), "admin").role).toBe("admin");
    });

    it("builder allowed when listed", () => {
      expect(requireRole(ctx("builder"), "admin", "builder").role).toBe("builder");
    });
  });

  describe("requireStepRole", () => {
    it("viewer cannot act on builder step", () => {
      expect(() => requireStepRole(ctx("viewer"), "builder")).toThrow(Forbidden);
    });

    it("builder can act on builder step", () => {
      expect(requireStepRole(ctx("builder"), "builder").role).toBe("builder");
    });

    it("admin can act on any step", () => {
      expect(requireStepRole(ctx("admin"), "viewer").role).toBe("admin");
    });
  });

  describe("canSeeInvoice", () => {
    const open = { ownerId: "o1", deletedAt: null };
    const deleted = { ownerId: "o1", deletedAt: new Date() };

    it("signed-out cannot see", () => {
      expect(canSeeInvoice(null, open)).toBe(false);
    });

    it("viewer/builder/admin can see open invoices", () => {
      expect(canSeeInvoice(ctx("viewer"), open)).toBe(true);
      expect(canSeeInvoice(ctx("builder"), open)).toBe(true);
      expect(canSeeInvoice(ctx("admin"), open)).toBe(true);
    });

    it("only admin can see soft-deleted invoices", () => {
      expect(canSeeInvoice(ctx("viewer"), deleted)).toBe(false);
      expect(canSeeInvoice(ctx("builder"), deleted)).toBe(false);
      expect(canSeeInvoice(ctx("admin"), deleted)).toBe(true);
    });
  });
});
