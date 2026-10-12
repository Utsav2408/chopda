#!/usr/bin/env node
// Points git at the committed .githooks/ directory so every clone gets the same
// pre-commit hook (gitleaks + lint-staged) without an extra dependency.
// Safe to run outside a git repo (e.g. inside a CI docker build) or on CI itself.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function run(cmd) {
  return execSync(cmd, { stdio: "pipe" }).toString().trim();
}

try {
  run("git rev-parse --is-inside-work-tree");
} catch {
  // Not a git repo (e.g. installing inside a CI build step) — nothing to do.
  process.exit(0);
}

if (!existsSync(".githooks")) {
  process.exit(0);
}

try {
  run("git config core.hooksPath .githooks");
  console.log("Git hooks path set to .githooks (pre-commit runs gitleaks + lint-staged checks).");
} catch (err) {
  console.warn("Could not set core.hooksPath automatically:", err.message);
}
