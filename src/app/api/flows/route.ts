/**
 * GET /api/flows — list; POST /api/flows — create draft (Admin/Builder).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { createDraft, createDraftInputSchema, list } from "@/server/flows";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const flows = await list(ctx);
    return NextResponse.json({ flows });
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
    const parsed = createDraftInputSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid create draft payload");
    const flow = await createDraft(ctx, parsed.data);
    return NextResponse.json({ flow }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
