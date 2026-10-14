#!/usr/bin/env tsx
/**
 * B2-09 / B9-02: Document / verify security headers and session cookie flags.
 *
 * Usage:
 *   pnpm check:security-headers
 *     → prints the expected header map + cookie flags (no network).
 *   pnpm check:security-headers https://example.com
 *     → fetches the URL and asserts each expected header matches.
 */
import { EXPECTED_SECURITY_HEADERS } from "../src/server/security/headers.js";
import {
  assertSessionCookieFlags,
  EXPECTED_SESSION_COOKIE_FLAGS,
} from "../src/server/security/cookie-flags.js";

export { EXPECTED_SECURITY_HEADERS, EXPECTED_SESSION_COOKIE_FLAGS, assertSessionCookieFlags };

function printExpected(): void {
  console.log("[check-security-headers] Expected headers:");
  for (const [key, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
    console.log(`  ${key}: ${value}`);
  }
  const flags = assertSessionCookieFlags();
  console.log("[check-security-headers] Expected session cookie flags:");
  console.log(`  name: ${flags.name}`);
  console.log(`  httpOnly: ${flags.httpOnly}`);
  console.log(`  sameSite: ${flags.sameSite}`);
  console.log(`  path: ${flags.path}`);
  console.log(`  maxAge: ${flags.maxAgeSeconds}`);
  console.log(`  secureInProduction: ${flags.secureInProduction}`);
}

async function checkUrl(url: string): Promise<void> {
  assertSessionCookieFlags();
  const res = await fetch(url, { redirect: "manual" });
  let failed = false;
  for (const [key, expected] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
    const actual = res.headers.get(key);
    if (actual !== expected) {
      console.error(
        `[check-security-headers] ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
  console.log(`[check-security-headers] OK — all expected headers present on ${url}`);
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    printExpected();
    console.log(
      "[check-security-headers] Pass a URL as argv[2] to fetch and verify against a running server.",
    );
    return;
  }
  await checkUrl(url);
}

main().catch((err) => {
  console.error("[check-security-headers] FAILED:", err);
  process.exit(1);
});
