/**
 * GET /api/invoices/[id] — detail; PATCH — update; DELETE — soft delete (Admin).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { get, softDelete, update, updateInvoiceInputSchema } from "@/server/invoices";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const invoice = await get(ctx, id);
    return NextResponse.json({ invoice });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const parsed = updateInvoiceInputSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid update invoice payload");
    const invoice = await update(ctx, id, parsed.data);
    return NextResponse.json({ invoice });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const result = await softDelete(ctx, id);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
