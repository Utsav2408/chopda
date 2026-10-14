/**
 * POST /api/invoices/[id]/steps/complete — complete a step (B5-05).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { completeStepInputSchema } from "@/server/invoices";
import { complete } from "@/server/steps";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const { id: invoiceId } = await params;
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const parsed = completeStepInputSchema.safeParse({
      ...(typeof body === "object" && body !== null ? body : {}),
      invoiceId,
    });
    if (!parsed.success) throw new Validation("Invalid complete step payload");
    const invoice = await complete(ctx, parsed.data);
    return NextResponse.json({ invoice });
  } catch (err) {
    return jsonError(err);
  }
}
