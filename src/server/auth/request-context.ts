/**
 * Resolve RequestContext from an incoming HTTP request's session cookie.
 */
import type { NextRequest } from "next/server";
import { Unauthenticated } from "../kernel/errors.js";
import { generateRequestId } from "../kernel/request-id.js";
import { SESSION_COOKIE_NAME } from "../security/constants.js";
import { resolveSession, type ResolvedSession } from "./service.js";

export type AuthedRequest = ResolvedSession & {
  token: string;
  requestId: string;
};

/** Read the session cookie token from a NextRequest (or plain Request). */
export function readSessionToken(request: Request | NextRequest): string | undefined {
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    return request.cookies.get(SESSION_COOKIE_NAME)?.value;
  }
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq);
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return undefined;
}

/** Require a valid session; throws Unauthenticated otherwise. */
export async function requireAuthedRequest(request: Request | NextRequest): Promise<AuthedRequest> {
  const requestId = generateRequestId();
  const token = readSessionToken(request);
  const resolved = await resolveSession(token, { requestId });
  if (!resolved) {
    throw new Unauthenticated();
  }
  return { ...resolved, token: token!, requestId };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

export function clientUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}
