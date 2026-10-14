/**
 * GET /api/invoices/[id]/history — audit history newest first (B7-05).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { forInvoice } from "@/server/history";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const entries = await forInvoice(ctx, id);
    return NextResponse.json({ entries });
  } catch (err) {
    return jsonError(err);
  }
}
