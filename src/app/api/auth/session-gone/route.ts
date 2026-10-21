/**
 * GET /api/auth/session-gone — clear a stale session cookie and send the user
 * to /login. Used when proxy saw a cookie but resolveSession failed (U2-01).
 */
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const login = new URL("/login", request.url);
  if (next && next.startsWith("/") && !next.startsWith("//") && next !== "/login") {
    login.searchParams.set("next", next);
  }
  const response = NextResponse.redirect(login);
  clearSessionCookie(response);
  return response;
}
