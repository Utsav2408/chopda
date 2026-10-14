/**
 * GET /api/dashboard — counts, byStep, needsAttention, recentActivity (B7-03/04).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { byStep, counts, needsAttention, recentActivity } from "@/server/dashboard";
import { jsonError } from "@/server/http/map-error";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const [countsResult, byStepResult, attention, activity] = await Promise.all([
      counts(ctx),
      byStep(ctx),
      needsAttention(ctx),
      recentActivity(ctx),
    ]);
    return NextResponse.json({
      counts: countsResult,
      byStep: byStepResult,
      needsAttention: attention,
      recentActivity: activity,
    });
  } catch (err) {
    return jsonError(err);
  }
}
