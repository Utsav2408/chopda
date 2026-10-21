/**
 * Every protected /api route must call requireAuthedRequest so a forgotten
 * handler cannot skip session verification.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(import.meta.dirname, "../../src/app/api");

/** Routes that intentionally skip session cookies (public, cron, auth plumbing). */
const ALLOWLIST = new Set([
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/session-gone/route.ts",
  "health/route.ts",
  "cron/purge/route.ts",
  "cron/reminders/route.ts",
]);

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

describe("API auth gate", () => {
  it("protected /api routes call requireAuthedRequest", () => {
    const routes = listRouteFiles(API_ROOT);
    expect(routes.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const file of routes) {
      const rel = relative(API_ROOT, file).replaceAll("\\", "/");
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (!src.includes("requireAuthedRequest")) {
        missing.push(rel);
      }
    }

    expect(missing, `routes missing requireAuthedRequest:\n${missing.join("\n")}`).toEqual([]);
  });

  it("allowlisted routes exist and skip requireAuthedRequest", () => {
    for (const rel of ALLOWLIST) {
      const full = join(API_ROOT, rel);
      const src = readFileSync(full, "utf8");
      expect(src.includes("requireAuthedRequest"), `${rel} should not require session`).toBe(false);
    }
  });
});
