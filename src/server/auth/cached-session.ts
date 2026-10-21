/**
 * Request-scoped session resolution. `React.cache` dedupes cookie → resolveSession
 * across layout, page, and parallel server actions in the same RSC request.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "../security/constants.js";
import { Unauthenticated } from "../kernel/errors.js";
import { resolveSession, type ResolvedSession } from "./service.js";

/** One resolveSession per request for the session cookie (touch defaults on). */
export const resolveSessionFromCookies = cache(async (): Promise<ResolvedSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  return resolveSession(token);
});

/** Same as resolveSessionFromCookies but throws Unauthenticated when missing. */
export async function requireSessionFromCookies(): Promise<ResolvedSession> {
  const resolved = await resolveSessionFromCookies();
  if (!resolved) {
    throw new Unauthenticated();
  }
  return resolved;
}

/**
 * Resolve a valid session for UI server actions, or redirect to login.
 * Prefer this over `requireSessionFromCookies` in mutation entrypoints so an
 * expired cookie mid-form lands on login (via session-gone) instead of throwing.
 */
export async function requireActionSession(nextPath?: string): Promise<ResolvedSession> {
  const resolved = await resolveSessionFromCookies();
  if (!resolved) {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      const login = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
      redirect(login);
    }
    const gone = nextPath
      ? `/api/auth/session-gone?next=${encodeURIComponent(nextPath)}`
      : "/api/auth/session-gone";
    redirect(gone);
  }
  return resolved;
}
