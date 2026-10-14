/**
 * GET /api/reminders — compute; POST — dismiss { key } (B7-06).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { compute, dismiss } from "@/server/reminders";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const items = await compute(ctx);
    return NextResponse.json({ items });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    if (
      !body ||
      typeof body !== "object" ||
      typeof (body as { key?: unknown }).key !== "string" ||
      !(body as { key: string }).key
    ) {
      throw new Validation("key is required");
    }
    await dismiss(ctx, (body as { key: string }).key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
