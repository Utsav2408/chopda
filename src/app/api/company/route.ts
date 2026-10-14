/**
 * GET /api/company — profile; PATCH /api/company — update (Admin).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { get, update, updateCompanyProfileSchema } from "@/server/company";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const profile = await get(ctx);
    return NextResponse.json({ profile });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
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
    const parsed = updateCompanyProfileSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid company profile payload");
    const profile = await update(ctx, parsed.data);
    return NextResponse.json({ profile });
  } catch (err) {
    return jsonError(err);
  }
}
