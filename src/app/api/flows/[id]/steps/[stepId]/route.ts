/**
 * PATCH /api/flows/[id]/steps/[stepId] — edit
 * DELETE /api/flows/[id]/steps/[stepId] — remove
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { editStep, flowStepInputSchema, removeStep } from "@/server/flows";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

type Params = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id, stepId } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const parsed = flowStepInputSchema.partial().safeParse(body);
    if (!parsed.success) throw new Validation("Invalid edit step payload");
    const flow = await editStep(ctx, id, stepId, parsed.data);
    return NextResponse.json({ flow });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id, stepId } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const flow = await removeStep(ctx, id, stepId);
    return NextResponse.json({ flow });
  } catch (err) {
    return jsonError(err);
  }
}
