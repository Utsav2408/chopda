/**
 * GET /api/dashboard — counts, byStep, needsAttention, recentActivity (B7-03/04).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { loadDashboard } from "@/server/dashboard";
import { jsonError } from "@/server/http/map-error";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const bundle = await loadDashboard(ctx);
    return NextResponse.json({
      counts: bundle.counts,
      byStep: bundle.byStep,
      needsAttention: bundle.needsAttention,
      recentActivity: bundle.recentActivity,
      ownerNames: bundle.ownerNames,
    });
  } catch (err) {
    return jsonError(err);
  }
}
