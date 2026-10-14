/**
 * Session cookie wiring for route handlers (B3-03).
 */
import type { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieFlags } from "../security/session.js";

export { SESSION_COOKIE_NAME };

/** Set the HttpOnly session cookie on a NextResponse. */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  opts?: { secure?: boolean },
): void {
  const flags = sessionCookieFlags(opts);
  response.cookies.set(SESSION_COOKIE_NAME, token, flags);
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(response: NextResponse, opts?: { secure?: boolean }): void {
  const flags = sessionCookieFlags(opts);
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...flags, maxAge: 0 });
}
