import { describe, expect, it, vi } from "vitest";
import { login, type LoginDeps } from "../../../src/server/auth/service.js";
import { RateLimited, Unauthenticated } from "../../../src/server/kernel/errors.js";
import type { AuthUserRow } from "../../../src/server/auth/repo.js";

const ACTIVE_USER: AuthUserRow = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "alice",
  passwordHash: "stored-hash",
  role: "builder",
  isActive: true,
  displayName: "Alice",
  email: null,
  phone: null,
  photoObjectKey: null,
  mustChangePassword: false,
};

function baseDeps(overrides: Partial<LoginDeps> = {}): Partial<LoginDeps> {
  return {
    checkRateLimit: async () => ({ allowed: true }),
    recordAttempt: async () => undefined,
    findUserByUsername: async () => ACTIVE_USER,
    createSession: async () => ({
      sessionId: "22222222-2222-4222-8222-222222222222",
      token: "raw-session-token",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    }),
    writeAudit: async () => undefined,
    verifyPassword: async () => true,
    hashPassword: async () => "new-hash",
    needsRehash: () => false,
    getDummyPasswordHash: async () => "dummy-hash",
    now: () => new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

const input = {
  username: "alice",
  password: "correct-password-long",
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "req-test",
};

describe("auth.login decision paths (B3-01)", () => {
  it("succeeds for good credentials", async () => {
    const result = await login(input, baseDeps());
    expect(result.token).toBe("raw-session-token");
    expect(result.user.username).toBe("alice");
    expect(result.user.role).toBe("builder");
  });

  it("fails with generic error on bad password and records attempt", async () => {
    const recordAttempt = vi.fn(async () => undefined);
    await expect(
      login(input, baseDeps({ verifyPassword: async () => false, recordAttempt })),
    ).rejects.toBeInstanceOf(Unauthenticated);
    await expect(
      login(input, baseDeps({ verifyPassword: async () => false, recordAttempt })),
    ).rejects.toThrow(/Invalid username or password/);
    expect(recordAttempt).toHaveBeenCalled();
  });

  it("fails with generic error for unknown user after verifying against dummy hash", async () => {
    const verifyPassword = vi.fn(async () => false);
    const getDummyPasswordHash = vi.fn(async () => "dummy-hash");
    await expect(
      login(
        input,
        baseDeps({
          findUserByUsername: async () => null,
          verifyPassword,
          getDummyPasswordHash,
        }),
      ),
    ).rejects.toBeInstanceOf(Unauthenticated);
    expect(getDummyPasswordHash).toHaveBeenCalled();
    expect(verifyPassword).toHaveBeenCalledWith(input.password, "dummy-hash");
  });

  it("fails with generic error when user is inactive", async () => {
    await expect(
      login(
        input,
        baseDeps({
          findUserByUsername: async () => ({ ...ACTIVE_USER, isActive: false }),
          verifyPassword: async () => true,
        }),
      ),
    ).rejects.toThrow(/Invalid username or password/);
  });

  it("blocks when rate-limited (locked)", async () => {
    await expect(
      login(input, baseDeps({ checkRateLimit: async () => ({ allowed: false }) })),
    ).rejects.toBeInstanceOf(RateLimited);
  });

  it("writes audit on success", async () => {
    const writeAudit = vi.fn(async () => undefined);
    await login(input, baseDeps({ writeAudit }));
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        entity: "session",
      }),
    );
  });
});
