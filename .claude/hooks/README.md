# Claude Code hooks

`pre-tool-use.mjs` is wired as a `PreToolUse` hook in `.claude/settings.json`
for `Edit`/`Write` tool calls.

## What it blocks today

- Any agent `Edit`/`Write` targeting a real `.env*` file (anything matching
  `.env` or `.env.<name>`, except `.env.example`). Exits with code `2`, which
  Claude Code treats as "block this tool call."

## What's deferred (Wave D — see `STATUS.md`)

These two checks from the GitHub repo checklist (§10.3) need real content to
check against, so they're not implemented yet:

1. **Block edits to already-committed files under `db/migrations/`.** Needs a
   first migration to exist (`P1-01`) and a reliable "already committed vs. new
   draft" check (e.g. `git log --oneline -- <file>` has entries). Add this once
   there's a real migrations history.
2. **Block commands containing a production connection string.** Needs a known
   production-host pattern to match once a production Neon branch/Vercel env
   exists. Add alongside Wave C (Vercel env vars) and Wave D.

Both are called out explicitly here (instead of silently doing nothing) so a
future pass doesn't assume they're already covered.
