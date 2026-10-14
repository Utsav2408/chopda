/**
 * Origin check helper for server actions and route handlers (B2-09).
 * Prefer Origin; fall back to Referer. Same-origin only unless extras listed.
 */
import { Forbidden, Validation } from "../kernel/errors.js";
import { MAX_INPUT_BYTES } from "./constants.js";

export { MAX_INPUT_BYTES } from "./constants.js";

function originFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Assert the request's Origin (or Referer) matches the request Host origin
 * or one of `trustedOrigins`. Throws Forbidden on mismatch; Validation when
 * neither Origin nor Referer is present on a state-changing check.
 */
export function assertSameOrigin(
  request: Request,
  opts?: { trustedOrigins?: string[]; requireHeader?: boolean },
): void {
  const url = new URL(request.url);
  const expected = url.origin;
  const trusted = new Set([expected, ...(opts?.trustedOrigins ?? [])]);

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    if (!trusted.has(originHeader)) {
      throw new Forbidden("Invalid origin");
    }
    return;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    const refOrigin = originFromUrl(referer);
    if (!refOrigin || !trusted.has(refOrigin)) {
      throw new Forbidden("Invalid origin");
    }
    return;
  }

  if (opts?.requireHeader !== false) {
    throw new Validation("Missing Origin or Referer");
  }
}

/** Throw Validation when a byte length exceeds MAX_INPUT_BYTES. */
export function assertInputSize(byteLength: number, max: number = MAX_INPUT_BYTES): void {
  if (byteLength > max) {
    throw new Validation(`Input exceeds maximum size of ${max} bytes`);
  }
}
