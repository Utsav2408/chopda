/**
 * POST /api/flows/[id]/duplicate
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { duplicate } from "@/server/flows";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const flow = await duplicate(ctx, id);
    return NextResponse.json({ flow }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
