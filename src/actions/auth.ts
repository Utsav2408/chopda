/**
 * UI-facing auth actions (U1-02 / U2). Lives outside `@/server` so app/components
 * can import without tripping the client DAL import ban.
 */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "../server/auth/index.js";
import { SESSION_COOKIE_NAME } from "../server/security/constants.js";
import type { CurrentUser } from "../lib/auth-dto.js";

/** Resolve the signed-in user from the session cookie, or null. */
export async function getOptionalCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const resolved = await resolveSession(token);
  return resolved?.user ?? null;
}

/** Resolve the signed-in user from the session cookie, or redirect to login. */
export async function requireCurrentUser(nextPath?: string): Promise<CurrentUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const login = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(login);
  }
  const resolved = await resolveSession(token);
  if (!resolved) {
    // Clear stale cookie via route so middleware ↔ app cannot redirect-loop.
    const gone = nextPath
      ? `/api/auth/session-gone?next=${encodeURIComponent(nextPath)}`
      : "/api/auth/session-gone";
    redirect(gone);
  }
  return resolved.user;
}

/**
 * Require a signed-in user who has completed the forced password change.
 * Used by the app shell layout.
 */
export async function requireAppUser(nextPath?: string): Promise<CurrentUser> {
  const user = await requireCurrentUser(nextPath);
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return user;
}
