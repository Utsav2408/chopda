/**
 * GET /api/users — list; POST /api/users — create (Admin).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { create, createUserSchema, list } from "@/server/users";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const users = await list(ctx);
    return NextResponse.json({ users });
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
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid create user payload");
    const result = await create(ctx, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
