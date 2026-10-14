/**
 * POST /api/invoices — create invoice (Admin/Builder).
 * GET list lands with B7.
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { create, createInvoiceInputSchema } from "@/server/invoices";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

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
    const parsed = createInvoiceInputSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid create invoice payload");
    const invoice = await create(ctx, parsed.data);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
