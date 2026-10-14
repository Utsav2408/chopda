/**
 * GET /api/users/:id
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { get } from "@/server/users";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const user = await get(ctx, id);
    return NextResponse.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}
