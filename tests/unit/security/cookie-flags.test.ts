import { describe, expect, it } from "vitest";
import {
  assertSessionCookieFlags,
  EXPECTED_SESSION_COOKIE_FLAGS,
} from "../../../src/server/security/cookie-flags.js";
import { sessionCookieFlags } from "../../../src/server/security/session.js";

describe("session cookie flags (B9-02)", () => {
  it("assertSessionCookieFlags matches documented expectations", () => {
    const flags = assertSessionCookieFlags();
    expect(flags).toEqual(EXPECTED_SESSION_COOKIE_FLAGS);
  });

  it("production flags are HttpOnly + Secure + SameSite=Lax", () => {
    const flags = sessionCookieFlags({ secure: true });
    expect(flags.httpOnly).toBe(true);
    expect(flags.secure).toBe(true);
    expect(flags.sameSite).toBe("lax");
    expect(flags.path).toBe("/");
    expect(flags.maxAge).toBe(EXPECTED_SESSION_COOKIE_FLAGS.maxAgeSeconds);
  });

  it("local/dev may omit Secure when secure:false", () => {
    const flags = sessionCookieFlags({ secure: false });
    expect(flags.httpOnly).toBe(true);
    expect(flags.secure).toBe(false);
    expect(flags.sameSite).toBe("lax");
  });
});
