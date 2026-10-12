#!/usr/bin/env node
// Claude Code PreToolUse hook (Wave D, deferred/partial — see STATUS.md).
//
// Scope today: blocks writes to `.env*` (except `.env.example`) regardless of
// the `allow`/`deny` permission rules in .claude/settings.json, as a second
// layer. This is the one check that's safe to make hard (exit 2) right now,
// because there is no legitimate reason to ever write a real .env file through
// an agent edit.
//
// Deferred to Wave D (first migration, P1-01) because they need real content to
// check against:
//   - Blocking edits to db/migrations/** files that are already committed
//     (forward-only rule in AGENTS.md / db/migrations/README.md). Needs a way
//     to tell "already committed" apart from "new, uncommitted migration" —
//     straightforward once there is a git history of migrations to diff
//     against; today the folder is empty.
//   - Blocking commands that embed a production connection string. Needs a
//     known production-looking pattern (e.g. a Neon prod branch host) to match
//     against; there's no production environment yet to pattern-match on.
//
// Reads the tool-call JSON from stdin per the Claude Code hooks contract:
// https://code.claude.com/docs/en/hooks (exit code 2 blocks the action).
import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main() {
  const raw = readStdin();
  if (!raw) process.exit(0);

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // not JSON we understand — don't block on a parse error
  }

  const filePath =
    input?.tool_input?.file_path ?? input?.tool_input?.path ?? input?.tool_input?.filePath ?? "";

  if (!filePath) process.exit(0);

  const isEnvFile = /(^|\/)\.env(\.[^/]+)?$/.test(filePath);
  const isExampleEnv = /\.env\.example$/.test(filePath);

  if (isEnvFile && !isExampleEnv) {
    console.error(
      `[pre-tool-use hook] Blocked: refusing to let an agent write "${filePath}". ` +
        "Real .env files hold dev secrets and must be edited by a human, never an agent. " +
        "Edit .env.example (names only) instead if you need to document a new variable.",
    );
    process.exit(2);
  }

  process.exit(0);
}

main();
