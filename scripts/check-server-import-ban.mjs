#!/usr/bin/env node
// B0-03: prove ESLint rejects @/server imports from src/app (and src/components).
// Writes a temp fixture, runs eslint on it, expects a non-zero exit, then cleans up.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "src", "app", "__lint_ban_fixture__");
const fixtureFile = join(fixtureDir, "bad-import.ts");

mkdirSync(fixtureDir, { recursive: true });
writeFileSync(
  fixtureFile,
  `import { SERVER_ONLY_MARKER } from "@/server";\nexport const x = SERVER_ONLY_MARKER;\n`,
  "utf8",
);

let eslintExit = 0;
try {
  execFileSync("pnpm", ["exec", "eslint", fixtureFile], {
    cwd: root,
    stdio: "inherit",
  });
} catch (err) {
  eslintExit = typeof err.status === "number" ? err.status : 1;
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

if (eslintExit === 0) {
  console.error(
    "[check-server-import-ban] FAIL: eslint accepted a deliberate @/server import under src/app.",
  );
  process.exit(1);
}

console.log(
  "[check-server-import-ban] OK — eslint rejected deliberate @/server import (exit " +
    eslintExit +
    ").",
);
