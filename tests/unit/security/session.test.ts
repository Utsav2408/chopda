import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  isSessionValid,
  sessionCookieFlags,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_MS,
  type SessionRow,
} from "../../../src/server/security/session.js";

function baseSession(overrides: Partial<SessionRow> = {}): SessionRow {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    tokenHash: hashSessionToken("raw-token"),
    expiresAt: new Date(createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS),
    lastSeenAt: createdAt,
    revokedAt: null,
    createdAt,
    ...overrides,
  };
}

describe("session module (B2-02)", () => {
  it("documents absolute 30d and idle 7d TTLs", () => {
    expect(SESSION_ABSOLUTE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(SESSION_IDLE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SESSION_COOKIE_NAME).toBe("chopda_session");
  });

  it("generateSessionToken is high-entropy and hash is deterministic", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
    expect(hashSessionToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("isSessionValid respects absolute expiry (mocked time)", () => {
    const session = baseSession();
    // Keep lastSeenAt fresh so idle timeout does not fire first.
    const beforeExpiry = new Date(session.expiresAt.getTime() - 1000);
    session.lastSeenAt = beforeExpiry;
    const afterExpiry = new Date(session.expiresAt.getTime() + 1000);
    expect(isSessionValid(session, beforeExpiry)).toBe(true);
    expect(isSessionValid(session, afterExpiry)).toBe(false);
  });

  it("isSessionValid respects idle timeout (mocked time)", () => {
    const session = baseSession({
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    });
    const withinIdle = new Date(session.lastSeenAt.getTime() + SESSION_IDLE_TTL_MS - 1000);
    const pastIdle = new Date(session.lastSeenAt.getTime() + SESSION_IDLE_TTL_MS + 1000);
    expect(isSessionValid(session, withinIdle)).toBe(true);
    expect(isSessionValid(session, pastIdle)).toBe(false);
  });

  it("isSessionValid rejects revoked sessions", () => {
    const session = baseSession({ revokedAt: new Date("2026-01-02T00:00:00.000Z") });
    expect(isSessionValid(session, new Date("2026-01-03T00:00:00.000Z"))).toBe(false);
  });

  it("sessionCookieFlags sets httpOnly, sameSite=lax, path=/, secure in production", () => {
    const flags = sessionCookieFlags({ secure: true });
    expect(flags).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000),
    });
  });

  it("tampered token hash does not match original", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hashSessionToken(token + "x")).not.toBe(hash);
  });
});
