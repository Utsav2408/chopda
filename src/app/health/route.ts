import { NextResponse } from "next/server";

// Deploy smoke-test endpoint (P0-05 evidence: "Preview deploy loads a health page").
// Intentionally has no DB/storage dependency so it stays up even if those are
// misconfigured — useful for distinguishing "app deployed" from "app healthy".
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "chopda",
    timestamp: new Date().toISOString(),
  });
}
