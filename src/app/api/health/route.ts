import { NextResponse } from "next/server";
import { check as healthCheck } from "@/server/health";

// Deploy smoke-test endpoint (P0-05 / B0-15).
// Default response stays dependency-free. Pass ?full=1 for B7-11 probes.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1" || url.searchParams.get("full") === "true";

  if (!full) {
    return NextResponse.json({
      status: "ok",
      service: "chopda",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = await healthCheck();
    const httpStatus = result.status === "ok" ? 200 : result.status === "degraded" ? 200 : 503;
    return NextResponse.json(result, { status: httpStatus });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        service: "chopda",
        timestamp: new Date().toISOString(),
        storageProvider: process.env.STORAGE_PROVIDER ?? "local",
        backupStatus: "none",
      },
      { status: 503 },
    );
  }
}
