#!/usr/bin/env tsx
/**
 * B0-08: Fail CI if the repo contains AI/agent surface before Phase 6.
 *
 * Scans (excluding docs/, node_modules/, .git/, .next/):
 * - agent routes under src/app/.../agent/... or paths containing api/agent
 * - agent_* table names in SQL / migrations / schema
 * - AI vendor key env names (OPENAI_*, ANTHROPIC_*, etc.)
 *
 * This script file is excluded from content scans so listing the forbidden
 * names here does not trip the guard.
 *
 * Note: avoid writing star-star-slash in this comment — that sequence ends a
 * block comment early in JavaScript.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "docs",
  "coverage",
  "playwright-report",
  "test-results",
  "dist",
]);

/** Basename of this guard — excluded from content matching. */
const SELF_BASENAME = "check-no-ai-before-phase6.ts";

const AI_VENDOR_KEY_NAMES = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "AI_GATEWAY_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "COHERE_API_KEY",
  "MISTRAL_API_KEY",
  "GROQ_API_KEY",
  "TOGETHER_API_KEY",
  "PERPLEXITY_API_KEY",
  "XAI_API_KEY",
  "DEEPSEEK_API_KEY",
] as const;

const AI_KEY_SET: readonly string[] = AI_VENDOR_KEY_NAMES;

/** Matches SQL/schema identifiers like agent_runs, agent_jobs (not "agent" alone). */
const AGENT_TABLE_RE = /\bagent_[a-z][a-z0-9_]*\b/gi;

export type AiViolation = {
  kind: "agent_route" | "agent_table" | "ai_vendor_key";
  path: string;
  detail: string;
};

function shouldSkipDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name);
}

function walkFiles(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // Skip most dotfiles/dirs; keep .github (workflows) and .env.example.
    if (entry.name.startsWith(".")) {
      if (entry.isDirectory() && entry.name !== ".github") continue;
      if (entry.isFile() && entry.name !== ".env.example") continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walkFiles(full, out);
      continue;
    }
    if (entry.isFile()) {
      out.push(full);
    }
  }
}

function toPosixRel(root: string, absPath: string): string {
  return relative(root, absPath).split(sep).join("/");
}

function isAgentRoutePath(relPosix: string): boolean {
  // src/app/**/agent/** (any file under an `agent` path segment in the App Router tree)
  if (
    /(^|\/)src\/app\/(?:.*\/)?agent\//.test(relPosix) ||
    /(^|\/)src\/app\/(?:.*\/)?agent$/.test(relPosix)
  ) {
    return true;
  }
  // api/agent as a path segment (route handlers or folders)
  if (/(^|\/)api\/agent(\/|$)/.test(relPosix)) {
    return true;
  }
  return false;
}

function isSchemaLike(relPosix: string): boolean {
  return (
    relPosix.endsWith(".sql") ||
    relPosix.includes("db/migrations/") ||
    relPosix.includes("/schema") ||
    /drizzle.*\.(ts|js)$/.test(relPosix)
  );
}

function isSelfOrTest(relPosix: string): boolean {
  const base = relPosix.split("/").pop() ?? "";
  if (base === SELF_BASENAME) return true;
  if (
    relPosix.includes("check-no-ai") &&
    (relPosix.includes("tests/") || relPosix.endsWith(".test.ts"))
  ) {
    return true;
  }
  return false;
}

/**
 * Scan a directory tree for Phase-6-premature AI/agent artifacts.
 * Exported for unit tests (planted violations in a temp tree).
 */
export function findAiViolations(rootDir: string): AiViolation[] {
  const root = rootDir;
  const files: string[] = [];
  walkFiles(root, files);
  const violations: AiViolation[] = [];

  for (const abs of files) {
    const rel = toPosixRel(root, abs);

    if (isAgentRoutePath(rel)) {
      violations.push({
        kind: "agent_route",
        path: rel,
        detail: "agent route path before Phase 6",
      });
    }

    if (isSelfOrTest(rel)) continue;

    let content: string;
    try {
      const st = statSync(abs);
      if (st.size > 2_000_000) continue; // skip huge binaries
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    if (isSchemaLike(rel)) {
      const matches = content.match(AGENT_TABLE_RE);
      if (matches) {
        for (const m of [...new Set(matches.map((x) => x.toLowerCase()))]) {
          violations.push({
            kind: "agent_table",
            path: rel,
            detail: `agent_* table/identifier: ${m}`,
          });
        }
      }
    }

    for (const key of AI_KEY_SET) {
      if (content.includes(key)) {
        violations.push({
          kind: "ai_vendor_key",
          path: rel,
          detail: `AI vendor env name: ${key}`,
        });
      }
    }
  }

  return violations;
}

function main(): void {
  const root = process.cwd();
  const violations = findAiViolations(root);
  if (violations.length > 0) {
    console.error(
      `[check-no-ai] Found ${violations.length} Phase-6-premature AI/agent artifact(s). ` +
        "Release 1 has no AI features — remove these before Phase 6 gates are met:",
    );
    for (const v of violations) {
      console.error(`  - [${v.kind}] ${v.path}: ${v.detail}`);
    }
    process.exit(1);
  }
  console.log(
    "[check-no-ai] OK — no agent routes, agent_* tables, or AI vendor keys before Phase 6.",
  );
}

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return entry.endsWith(SELF_BASENAME);
  }
}

if (isExecutedDirectly()) {
  main();
}
