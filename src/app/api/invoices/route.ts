/**
 * GET /api/invoices — list with tabs/filters (B7-01).
 * POST /api/invoices — create invoice (Admin/Builder).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { create, createInvoiceInputSchema, list, listInvoicesQuerySchema } from "@/server/invoices";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const parsed = listInvoicesQuerySchema.safeParse(raw);
    if (!parsed.success) throw new Validation("Invalid list query");
    const result = await list(ctx, parsed.data);
    return NextResponse.json(result);
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
    const parsed = createInvoiceInputSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid create invoice payload");
    const invoice = await create(ctx, parsed.data);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
