/**
 * GET /api/invoices/deleted — recently deleted with days left (Admin, B7-08).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { listDeleted } from "@/server/invoices";
import { jsonError } from "@/server/http/map-error";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const items = await listDeleted(ctx);
    return NextResponse.json({ items });
  } catch (err) {
    return jsonError(err);
  }
}
