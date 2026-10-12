@AGENTS.md

## Claude Code-only notes

- Personal overrides go in `.claude/settings.local.json` (gitignored, never
  commit it). Project-wide permission/deny rules are in `.claude/settings.json`
  and are committed — don't weaken them in a feature PR; agent-config changes
  reviewed on their own.
- `CLAUDE.local.md` is gitignored too; don't rely on it for anything the next
  session (or another agent) needs to know — put durable rules in `AGENTS.md`.
- PreToolUse hooks live in `.claude/hooks/` — see `.claude/hooks/README.md` for
  what they currently check and what's still deferred (Wave D in `STATUS.md`).
