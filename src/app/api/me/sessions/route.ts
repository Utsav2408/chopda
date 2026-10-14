import { NextResponse } from "next/server";
import { listOwnSessions } from "@/server/auth";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { jsonError } from "@/server/http/map-error";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const sessions = await listOwnSessions(ctx);
    return NextResponse.json({ sessions });
  } catch (err) {
    return jsonError(err);
  }
}
