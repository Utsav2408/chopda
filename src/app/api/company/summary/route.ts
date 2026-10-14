/**
 * GET /api/company/summary — current Admin + role counts.
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { summary } from "@/server/company";
import { jsonError } from "@/server/http/map-error";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const result = await summary(ctx);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
