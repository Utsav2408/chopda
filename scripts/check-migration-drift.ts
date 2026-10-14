#!/usr/bin/env tsx
/**
 * B1-16: Fail if `drizzle-kit generate` would produce new migration files
 * (schema.ts out of sync with db/migrations/meta snapshots).
 *
 * Compares `git status --porcelain db/migrations` before vs after generate so
 * already-uncommitted migration work does not false-fail; only churn from
 * generate does. In CI on a clean tree this matches `git diff --exit-code`.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function migrationsStatus(): string {
  return execSync("git status --porcelain -- db/migrations", {
    encoding: "utf8",
  });
}

function main() {
  if (!existsSync("drizzle.config.ts") || !existsSync("src/server/db/schema.ts")) {
    console.error("[migration-drift] missing drizzle.config.ts or schema.ts");
    process.exit(1);
  }

  const before = migrationsStatus();

  console.log("[migration-drift] running drizzle-kit generate …");
  execSync("pnpm exec drizzle-kit generate", { stdio: "inherit" });

  const after = migrationsStatus();

  if (before !== after) {
    console.error("[migration-drift] schema drift detected under db/migrations:");
    console.error(after);
    console.error("Commit a new migration (review hand-written RLS/triggers) or revert schema.ts.");
    process.exit(1);
  }

  console.log("[migration-drift] clean — schema matches migration snapshots.");
}

main();
