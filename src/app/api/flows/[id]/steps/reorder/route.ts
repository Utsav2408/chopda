/**
 * POST /api/flows/[id]/steps/reorder
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { reorderSteps } from "@/server/flows";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const orderedStepIds = (body as { orderedStepIds?: unknown })?.orderedStepIds;
    if (!Array.isArray(orderedStepIds) || !orderedStepIds.every((x) => typeof x === "string")) {
      throw new Validation("orderedStepIds must be a string array");
    }
    const flow = await reorderSteps(ctx, id, orderedStepIds);
    return NextResponse.json({ flow });
  } catch (err) {
    return jsonError(err);
  }
}
