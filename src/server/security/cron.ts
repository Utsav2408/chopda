/**
 * Cron route guard (B2-11): constant-time compare of Authorization bearer
 * (or `x-cron-secret`) against CRON_SECRET.
 */
import { constantTimeEqual } from "./password.js";
import { Unauthenticated } from "../kernel/errors.js";

function extractProvidedSecret(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m?.[1]) return m[1];
  }
  const header = request.headers.get("x-cron-secret");
  if (header && header.length > 0) return header;
  return null;
}

/**
 * Verify the request carries CRON_SECRET. Throws Unauthenticated on
 * missing/wrong secret (callers map to HTTP 401).
 */
export function requireCronSecret(request: Request, opts?: { secret?: string }): void {
  const expected = opts?.secret ?? process.env.CRON_SECRET;
  if (!expected) {
    throw new Unauthenticated("Cron secret not configured");
  }
  const provided = extractProvidedSecret(request);
  if (!provided || !constantTimeEqual(provided, expected)) {
    throw new Unauthenticated();
  }
}
