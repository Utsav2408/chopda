import { describe, expect, it, vi } from "vitest";
import { create } from "../../../src/server/users/service.js";
import type { RequestContext } from "../../../src/server/db/with-user.js";
import { Forbidden, Unauthenticated, Validation } from "../../../src/server/kernel/errors.js";
import type { UserRow } from "../../../src/server/users/repo.js";

function ctx(role: RequestContext["role"]): RequestContext {
  return {
    userId: "33333333-3333-4333-8333-333333333333",
    role,
    requestId: "req-test",
  };
}

const createdRow: UserRow = {
  id: "44444444-4444-4444-8444-444444444444",
  username: "newviewer",
  passwordHash: "hash",
  role: "viewer",
  isActive: true,
  displayName: "New Viewer",
  email: null,
  phone: null,
  photoObjectKey: null,
  mustChangePassword: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const input = {
  username: "newviewer",
  displayName: "New Viewer",
  role: "viewer" as const,
};

describe("users.create role checks (B3-05)", () => {
  it("signed-out is Unauthenticated", async () => {
    await expect(
      create(null, input, { insertUser: async () => createdRow }),
    ).rejects.toBeInstanceOf(Unauthenticated);
  });

  it("viewer is Forbidden", async () => {
    await expect(
      create(ctx("viewer"), input, { insertUser: async () => createdRow }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("builder is Forbidden", async () => {
    await expect(
      create(ctx("builder"), input, { insertUser: async () => createdRow }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("admin can create viewer with temp password and must_change_password", async () => {
    const insertUser = vi.fn(async () => createdRow);
    const writeAudit = vi.fn(async () => undefined);
    const result = await create(ctx("admin"), input, {
      insertUser,
      generateTemporaryPassword: () => "temp-password-value",
      hashPassword: async () => "hashed-temp",
      writeAudit,
    });
    expect(result.temporaryPassword).toBe("temp-password-value");
    expect(result.user.mustChangePassword).toBe(true);
    expect(result.user.role).toBe("viewer");
    expect(insertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "newviewer",
        role: "viewer",
        mustChangePassword: true,
        passwordHash: "hashed-temp",
      }),
    );
    expect(writeAudit).toHaveBeenCalled();
  });

  it("refuses creating admin role via validation", async () => {
    await expect(
      create(
        ctx("admin"),
        { ...input, role: "admin" as unknown as "viewer" },
        { insertUser: async () => createdRow },
      ),
    ).rejects.toBeInstanceOf(Validation);
  });
});
