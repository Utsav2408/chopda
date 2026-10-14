/**
 * GET/POST /api/cron/purge — retention purge job (B7-10).
 * Guarded by CRON_SECRET. Optional ?dryRun=1.
 */
import { NextResponse } from "next/server";
import { runPurge } from "@/server/jobs";
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
    const url = new URL(request.url);
    const dryRun =
      url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
    const result = await runPurge({
      dryRun,
      ctx: { ...CRON_ACTOR, requestId: generateRequestId() },
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

export const GET = handle;
export const POST = handle;
