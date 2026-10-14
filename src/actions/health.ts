/**
 * UI-facing health probe (U4-06 dashboard card — same data as GET /api/health?full=1).
 */
"use server";

import { check, type HealthCheckResult } from "../server/health/index.js";

export async function healthFullCheckAction(): Promise<HealthCheckResult> {
  return check();
}
