/**
 * POST /api/invoices/[id]/undo — restore soft-deleted invoice within window (Admin).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { undo } from "@/server/invoices";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const result = await undo(ctx, id);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
