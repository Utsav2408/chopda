import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  setSessionCookie,
  SESSION_COOKIE_NAME,
} from "../../../src/server/auth/cookies.js";
import { SESSION_ABSOLUTE_TTL_MS } from "../../../src/server/security/session.js";

describe("session cookie helper (B3-03)", () => {
  it("sets httpOnly / sameSite / path / maxAge flags", () => {
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, "token-value", { secure: true });
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("token-value");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000));
  });

  it("clears the cookie with maxAge 0", () => {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res, { secure: false });
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
