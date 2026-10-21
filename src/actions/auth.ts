/**
 * UI-facing auth actions (U1-02 / U2). Lives outside `@/server` so app/components
 * can import without tripping the client DAL import ban.
 */
"use server";

import { redirect } from "next/navigation";
import { requireActionSession, resolveSessionFromCookies } from "../server/auth/cached-session.js";
import type { CurrentUser } from "../lib/auth-dto.js";

/** Resolve the signed-in user from the session cookie, or null. */
export async function getOptionalCurrentUser(): Promise<CurrentUser | null> {
  const resolved = await resolveSessionFromCookies();
  return resolved?.user ?? null;
}

/**
 * Resolve the signed-in user for UI server actions / pages, or redirect to login.
 * Uses session-gone when a stale cookie is present (avoids proxy↔app loops).
 */
export async function requireActionUser(nextPath?: string): Promise<CurrentUser> {
  const resolved = await requireActionSession(nextPath);
  return resolved.user;
}

/** Resolve the signed-in user from the session cookie, or redirect to login. */
export async function requireCurrentUser(nextPath?: string): Promise<CurrentUser> {
  return requireActionUser(nextPath);
}

/**
 * Require a signed-in user who has completed the forced password change.
 * Used by the app shell layout.
 */
export async function requireAppUser(nextPath?: string): Promise<CurrentUser> {
  const user = await requireActionUser(nextPath);
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return user;
}
