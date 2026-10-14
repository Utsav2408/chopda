/**
 * GET /api/flows/[id]/diff/[otherId]
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { diffAgainst } from "@/server/flows";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string; otherId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id, otherId } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const diff = await diffAgainst(ctx, id, otherId);
    return NextResponse.json({ diff });
  } catch (err) {
    return jsonError(err);
  }
}
