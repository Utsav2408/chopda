# Agent rules for this repo

Single source of truth for any AI coding agent (Cursor, Claude Code, or other)
working in this repo. This file is public — no account names, key storage
locations, or private URLs belong here (see `DECISIONS.md`).

## What this is

Chopda: a private invoice tracker where teams build their own step-by-step
flows and track every invoice and its documents through them. Next.js (App
Router, TypeScript) + PostgreSQL (Neon). Full plan:
`docs/invoice-tracker-phasewise-implementation-plan.md`. Schema/security:
`docs/invoice-tracker-database-and-security-architecture.md`. Repo/CI
checklist: `docs/invoice-tracker-github-repo-checklist.md`.

## Commands

```bash
pnpm install          # install deps (--frozen-lockfile in CI)
pnpm dev              # dev server
pnpm lint              # ESLint
pnpm typecheck         # tsc --noEmit
pnpm test              # Vitest unit tests
pnpm test:e2e          # Playwright (needs a running/built app)
pnpm build             # production build
pnpm db:generate       # drizzle-kit generate (new migration from schema)
pnpm db:migrate        # apply pending migrations (uses DATABASE_URL_DIRECT)
pnpm storage:smoke     # write/read/delete smoke test for local storage
pnpm check:public-env  # fail if a NEXT_PUBLIC_ var name looks like a secret
```

## The plan's agent rules (apply to every change)

1. Work items have IDs like `P3-04`. Reference them in commits, PR titles, and
   `STATUS.md`.
2. One work item = one branch/PR with its tests. Don't start items whose
   `Needs` column (in the phasewise plan) isn't done.
3. Re-check roles in every server action and route handler. Hiding a button is
   never the control — the server must refuse it too.
4. Never put file bytes in the database, never expose a public file URL, never
   store a password or secret in the repo.
5. "Done" needs evidence: a command output, test name, query result, or
   synthetic screenshot pasted in `STATUS.md`. No evidence, not done.
6. Stop and ask the owner when a work item hits an open decision (see
   `DECISIONS.md` "Still open"). Do not guess.
7. Do not deploy anywhere that accepts uploads, and do not load real data,
   until `P5-15` (reliable file storage) is done. The local storage adapter
   must refuse to start in production (it already does — see
   `src/server/storage/index.ts`).
8. Release 1 (Phases 0–5) contains no AI features: no model calls, no AI
   vendor keys, no agent tables, no agent routes, no Agent navigation item.
   Phase 6 work does not start before its gates are met (see `STATUS.md`).

## Never do

- Edit an already-applied migration file. Migrations are forward-only — write
  a new one to fix a mistake.
- Run `drizzle-kit push` against anything but a throwaway database.
- Read, print, or echo the contents of `.env` / `.env.*` (except
  `.env.example`), or anything under the storage folder.
- Add secrets, real names, real customer/invoice data, or account identifiers
  to any file, fixture, test, or commit message.
- Use a `NEXT_PUBLIC_` prefix for anything secret (`security.yml` checks
  variable _names_, not just values).
- Push to `main` directly, or merge without a green `ci.yml` run.

## Where things live

- Data access layer (DAL): `src/server/` (imports `"server-only"`; nothing
  here is reachable from a Client Component).
- Storage adapter: `src/server/storage/` (local-folder today; swappable per
  `P5-15`).
- Audit writer: lands in Phase 1 (`P1-13`) inside `src/server/`; it is the
  single place that writes `audit_log` rows.
- Migrations: `db/migrations/` (generated + hand-written SQL for RLS/triggers;
  see `db/migrations/README.md`).

## Agent config files in this repo

- `CLAUDE.md` — thin wrapper, first line `@AGENTS.md`.
- `.claude/settings.json` — shared permission/deny rules and hooks for Claude
  Code (committed). `.claude/settings.local.json` is personal and gitignored.
- `.cursorignore` — keeps secret-like paths out of Cursor's context (not a
  security boundary on its own — see `.claude/settings.json` deny rules and
  keep terminal auto-run restricted).
- No `.cursor/rules/*.mdc` yet — add a path-scoped rule only when the same
  mistake repeats, and review that edit like code.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
