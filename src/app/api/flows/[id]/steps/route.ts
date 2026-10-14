/**
 * POST /api/flows/[id]/steps — add a step to the draft.
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { addStep, flowStepInputSchema } from "@/server/flows";
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
    const parsed = flowStepInputSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid add step payload");
    const flow = await addStep(ctx, id, parsed.data);
    return NextResponse.json({ flow });
  } catch (err) {
    return jsonError(err);
  }
}
