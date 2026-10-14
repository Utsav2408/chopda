/**
 * POST /api/auth/login (B3-03) — set session cookie on success.
 */
import { NextResponse } from "next/server";
import { login, loginBodySchema, setSessionCookie } from "@/server/auth";
import { clientIp, clientUserAgent } from "@/server/auth/request-context";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { generateRequestId } from "@/server/kernel/request-id";
import { Validation } from "@/server/kernel/errors";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new Validation("Invalid login payload");
    }

    const result = await login({
      ...parsed.data,
      ip: clientIp(request),
      userAgent: clientUserAgent(request),
      requestId: generateRequestId(),
    });

    const response = NextResponse.json({
      user: result.user,
      expiresAt: result.expiresAt.toISOString(),
    });
    setSessionCookie(response, result.token);
    return response;
  } catch (err) {
    return jsonError(err);
  }
}
