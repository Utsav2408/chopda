/**
 * GET/POST /api/cron/reminders — dismissals sweep (B7-10).
 * Guarded by CRON_SECRET.
 */
import { NextResponse } from "next/server";
import { runCronSweep } from "@/server/reminders";
import { requireCronSecret } from "@/server/security/cron";
import { jsonError } from "@/server/http/map-error";
import { generateRequestId } from "@/server/kernel";

const CRON_ACTOR = {
  userId: "00000000-0000-4000-8000-000000000001",
  role: "admin" as const,
};

async function handle(request: Request) {
  try {
    requireCronSecret(request);
    const result = await runCronSweep({
      ...CRON_ACTOR,
      requestId: generateRequestId(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

export const GET = handle;
export const POST = handle;
