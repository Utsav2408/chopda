/**
 * POST /api/auth/logout (B3-03) — revoke session and clear cookie.
 */
import { NextResponse } from "next/server";
import { clearSessionCookie, logout } from "@/server/auth";
import { readSessionToken } from "@/server/auth/request-context";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = readSessionToken(request);
    await logout(token);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (err) {
    return jsonError(err);
  }
}
