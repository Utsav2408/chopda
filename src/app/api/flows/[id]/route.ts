/**
 * GET /api/flows/[id]
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { get } from "@/server/flows";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const flow = await get(ctx, id);
    return NextResponse.json({ flow });
  } catch (err) {
    return jsonError(err);
  }
}
