import { NextResponse } from "next/server";

// Deploy smoke-test endpoint (P0-05 / B0-15). Canonical path: `/api/health`.
// Intentionally has no DB/storage dependency yet — full probes land in B7-11.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "chopda",
    timestamp: new Date().toISOString(),
  });
}
