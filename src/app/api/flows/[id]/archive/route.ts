/**
 * POST /api/flows/[id]/archive
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { archive } from "@/server/flows";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const flow = await archive(ctx, id);
    return NextResponse.json({ flow });
  } catch (err) {
    return jsonError(err);
  }
}
