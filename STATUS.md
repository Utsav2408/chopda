# Status

One row per work item. States: `todo`, `doing`, `blocked`, `done`. "Done" means
evidence is pasted below (plan rule 5) — a command output, test name, query
result, or screenshot path. No evidence, not done. Screenshots and fixtures must
contain only synthetic data (no real names, invoices, or account details).

## Repo hygiene, CI/CD and agent config

Tracks the [GitHub repo checklist](docs/invoice-tracker-github-repo-checklist.md),
not the phasewise plan's `P#-##` IDs. See that doc for the full checklist this
summarizes.

| Wave                                     | Scope                                                                                                                                         | Status                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Pre-push hygiene                     | `.gitignore`, `SECURITY.md`, README skeleton, docs/ reviewed for secrets/PII, `gitleaks detect`                                               | **done**                      | `gitleaks detect` and `gitleaks detect --no-git` both report "no leaks found" on the current tree/history (run 2026-10-11). `docs/` reviewed for real names/emails/GSTIN/PAN/bank details/Neon IDs — none found; content is already generic planning prose.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| B1 — Scaffold                            | Next.js App Router + TS, ESLint/Prettier/`.editorconfig`/`tsconfig strict`, Vitest, Playwright config, `.nvmrc` + `engines`, `pnpm-lock.yaml` | **done**                      | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass locally (2026-10-11). `pnpm-lock.yaml` committed-ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| B2 — Tracking docs                       | `STATUS.md`, `DECISIONS.md`                                                                                                                   | **done**                      | This file + `DECISIONS.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| B3 — Contributor/PR hygiene              | `CONTRIBUTING.md`, PR template, Dependabot                                                                                                    | **done**                      | Files present under repo root / `.github/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| B4 — CI & security workflows             | `ci.yml`, `security.yml`, `scorecard.yml`                                                                                                     | **done**                      | 2026-10-12 follow-up pass (authenticated `gh` session): found and fixed two further bugs beyond the ruleset-enforcement fix. (1) Actions allow-list patterns (`actions/checkout`, etc.) were missing `@ref` wildcards, so GitHub silently rejected every SHA-pinned action despite it being "in the list" — confirmed via the rejection annotation on `scorecard.yml` run `38200973959`, fixed via `PUT .../actions/permissions/selected-actions` (added `@*` to each pattern), re-verified green (`scorecard` run `38201109877`, 25s success). (2) The ruleset's required check `ci` could never be satisfied because the `ci.yml` job's display name was `"lint, typecheck, unit tests, build"`, not `ci` — every PR was stuck `mergeStateStatus: BLOCKED` even at 100% green; fixed with a one-line job-name rename (commit `256dbee`). Proof: PR #2 (https://github.com/Utsav2408/chopda/pull/2) — `ci` (run `38202156752`), `security`'s three jobs (run `38202156746`), and CodeQL's two analyses (run `38202154083`) all `success`, `mergeStateStatus: CLEAN`. |
| B5 — Pre-commit hook                     | `.githooks/pre-commit` (gitleaks + lint), `core.hooksPath` wiring                                                                             | **done**                      | `pnpm install` runs `scripts/setup-git-hooks.mjs`, which sets `git config core.hooksPath .githooks`. Verified locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| B6 — Agent config                        | `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.cursorignore`                                                                            | **done**                      | Files present; no account names or private URLs in any of them (reviewed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| B7 — Local env & storage                 | `.env.example`, `FILE_STORAGE_DIR` gitignored, storage smoke script                                                                           | **done**                      | `pnpm storage:smoke` passes (write/read/delete + gitignore check) against a temp dir. Owner still needs to point a real local `.env` at a Neon **dev** branch with fake data (see `DECISIONS.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C — GitHub & Vercel Settings (manual UI) | Ruleset, security settings, Actions settings, Vercel project + env vars + preview auth                                                        | **done**                      | **GitHub (§1–7):** settled 2026-10-12 via authenticated `gh` (see prior evidence / PR #2). **Vercel (§8–11):** settled same day via authenticated Vercel MCP + HTTP probes (CLI installed locally but was logged out; MCP used instead). Project `chopda` is Next.js / Node 24, linked to this GitHub repo; Hobby personal account (owner-confirmed). Env keys present for Production+Preview (names/targets only — values not read): `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `STORAGE_PROVIDER`, `CRON_SECRET`. Vercel Authentication on (`ssoProtection` for all except custom domains): unauthenticated Preview `/health` → HTTP 302 SSO; Production `/health` → HTTP 200 `{"status":"ok","service":"chopda",...}`. Soft notes for later: prefer separate Preview secrets before real data; confirm Production `STORAGE_PROVIDER` is not `local` before uploads (`P5-15`).                                                                                                                                               |
| D — Post-first-migration CI/hooks        | `db-tests`, `migration-drift`, Neon branch-per-PR, real `e2e.yml`, Claude PreToolUse hooks                                                    | **deferred**                  | Scaffolded, not fully wired — see "Wave D — deferred until first migration" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| E — Phase 5 pre-prod hardening           | Agent/MCP config audit, `NEXT_PUBLIC_` secret-name CI check, header tests, repo mirror backup, history re-scan                                | **partially done / deferred** | `NEXT_PUBLIC_` name check implemented and running in CI now (`scripts/check-public-env-names.ts`, wired into `security.yml`). Header tests, mirror backup, and full history re-scan documented as deferred to Phase 5 — see "Wave E" section below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Wave D — deferred until first migration (`P1-01`)

These need a real schema to test against, so they are scaffolded but intentionally
not doing real work yet:

- **`db-tests` job** — not added to `ci.yml` yet. Ready-to-enable recipe: spin up
  a `postgres:16` service container (or a Neon branch via the Neon GitHub Action),
  run `pnpm db:migrate` against it, then run DB-backed Vitest tests (RLS/trigger
  checks). Add once `P1-01` lands.
- **`migration-drift` job** — not added yet. Recipe: run `pnpm db:generate` in CI
  and fail if it produces any new file (`git diff --exit-code db/migrations`).
  Add once there is a Drizzle schema to generate from.
- **Neon branch-per-PR** — not configured. Needs a Neon API key as a repository
  secret (Wave C) and the official Neon GitHub Action to create/delete a branch
  per PR. Add alongside `db-tests`.
- **`e2e.yml`** — [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) exists
  now, triggered by `workflow_dispatch` only (soft-skip). It builds the app,
  starts it, and runs `pnpm test:e2e` against the one smoke spec
  (`tests/e2e/health.spec.ts`). Switch its trigger to `pull_request`/`push` and
  expand the spec set once Phase 1 (`P1-06` sign-in) lands.
- **Claude Code PreToolUse hooks** — scaffolded under
  [`.claude/hooks/`](.claude/hooks/) and wired in `.claude/settings.json`
  (currently log-only / non-blocking by default where noted). Harden to actually
  block (exit code 2) once there are committed migrations and a real `.env` to
  protect against accidental edits — see `.claude/hooks/README.md`.

### Wave E — deferred to Phase 5

- **Security headers test** — `next.config.ts` already sets basic headers
  (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS,
  Permissions-Policy). A scripted check that asserts these on a running build
  (`P5-07`) is not written yet — add with the Phase 5 security test suite
  (`P5-06`).
- **Repo mirror / bundle backup** — not scheduled yet. Recipe: a periodic
  `git bundle create chopda-$(date +%F).bundle --all`, copied to the owner's file
  store, or a scheduled mirror clone on a second machine. Add before Phase 5
  go-live (`P5-09` backups gate covers data; this covers the code itself per
  checklist §9).
- **Full-history gitleaks + personal-data re-scan** — `gitleaks detect` was run
  once now (Wave A, clean). Re-run on the full history again right before Phase 5
  real-data go-live, per checklist §11 "Phase 5" checklist and `P5-08`.
- **`.claude/`/`.cursor`/`AGENTS.md`/MCP config audit** — do a dedicated pass for
  secrets, private names, and over-broad allow rules right before real data goes
  in (`P5-12`/`P5-13` neighbors this). Not done as a one-time pass yet because
  there is no real data or account info in these files today (verified Wave A).

## Phase 0 — Decisions and setup

| ID    | Work item                                                                           | Status | PR                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-01 | Owner decisions (D1–D5) copied into `DECISIONS.md`                                  | done   | —                                                  | `DECISIONS.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| P0-02 | Git repo + Next.js (App Router, TS), lint, format, Vitest, Playwright, CI workflow  | done   | [#2](https://github.com/Utsav2408/chopda/pull/2)   | Scaffold done, local checks green (see Wave B1 above). First push 2026-10-12 (`aacad8d`) hit CI `startup_failure`; follow-up pass same day fixed the Actions allow-list and required-check-name bugs — `ci` now runs and passes for real (PR #2, run `38202156752`, `mergeStateStatus: CLEAN`). See Wave B4 above.                                                                                                                                   |
| P0-03 | Neon project created; connection strings in Vercel + local env only                 | done   | [#13](https://github.com/Utsav2408/chopda/pull/13) | 2026-10-14: initial Neon project (US East). **2026-10-20:** dual-project region split — Singapore Neon project for local + Vercel Preview; US East (Ohio) Neon project for Production. Local `.env` + `.neon` retargeted; Preview `DATABASE_URL` updated; Production unchanged. Singapore migrated + seeded; warm `select 1` ~105ms from India (was multi-hundred ms+ to Ohio). Runtime still uses owner pooled role (switch to `app_user` later). Wave D Neon branch-per-PR still deferred. |
| P0-04 | Local file storage folder + `FILE_STORAGE_DIR`/`STORAGE_PROVIDER=local`, gitignored | doing  | —                                                  | Adapter + `pnpm storage:smoke` pass against a temp dir. Owner still needs to point `.env.FILE_STORAGE_DIR` at a real folder outside the repo.                                                                                                                                                                                                                                                                                                                                                |
| P0-05 | Vercel project from repo; env vars set; preview deploy loads health page            | done   | —                                                  | 2026-10-12: Vercel project linked; required env keys present (Production+Preview); Production `/health` returned ok; Preview `/health` gated by Vercel Authentication (302 SSO). Evidence in Wave C row above (no production URLs/IDs here).                                                                                                                                                                                                                    |
| P0-06 | `.env.example`, README, `STATUS.md` with every work item as `todo`                  | done   | —                                                  | `.env.example`, `README.md`, this file.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| P0-07 | Encryption key stored in two places outside the DB; rotation steps noted            | todo   | —                                                  | Owner action, kept in **local private notes only** (not this repo) — see `DECISIONS.md`.                                                                                                                                                                                                                                                                                                                                                                                                     |

## Phase 1 — Foundation (sign-in, roles, base schema)

| ID    | Work item                                                                     | Status | PR  | Evidence                                                                 |
| ----- | ----------------------------------------------------------------------------- | ------ | --- | ------------------------------------------------------------------------ |
| P1-01 | Migration 001: extensions, `user_role` enum, `users`, `sessions`, `audit_log` | todo   | —   | —                                                                        |
| P1-02 | DB roles: owner role + limited `app_user`; revoke write on `audit_log`        | todo   | —   | —                                                                        |
| P1-03 | Password module: argon2id hash/verify, min length, constant-time compare      | todo   | —   | —                                                                        |
| P1-04 | Session module: random token, hash stored, expiry, revoke, secure cookie      | todo   | —   | —                                                                        |
| P1-05 | Login rate limiting/lockout stored in Postgres                                | todo   | —   | —                                                                        |
| P1-06 | Sign-in screen `(auth)/login`                                                 | todo   | —   | Placeholder page exists (`src/app/(auth)/login/page.tsx`); no logic yet. |
| P1-07 | `middleware.ts` session + role gate per route group                           | todo   | —   | —                                                                        |
| P1-08 | Request context: `SET LOCAL app.user_id`, `withUser(tx)` helper               | todo   | —   | —                                                                        |
| P1-09 | RLS on `users`                                                                | todo   | —   | —                                                                        |
| P1-10 | Bootstrap script for the single Admin                                         | todo   | —   | —                                                                        |
| P1-11 | Admin users screen `(app)/admin/users`                                        | todo   | —   | —                                                                        |
| P1-12 | Transfer Admin role server action                                             | todo   | —   | —                                                                        |
| P1-13 | Audit writer                                                                  | todo   | —   | —                                                                        |
| P1-14 | App shell navigation by role                                                  | todo   | —   | Placeholder dashboard page exists (`src/app/(app)/dashboard/page.tsx`).  |

## Phase 2 — Flow engine

| ID    | Work item                                                      | Status | PR  | Evidence |
| ----- | -------------------------------------------------------------- | ------ | --- | -------- |
| P2-01 | Migration 002: `flow_templates`, `flow_versions`, `flow_steps` | todo   | —   | —        |
| P2-02 | Zod schema for `fields` list                                   | todo   | —   | —        |
| P2-03 | Trigger blocking edits to published steps                      | todo   | —   | —        |
| P2-04 | RLS for flow tables                                            | todo   | —   | —        |
| P2-05 | Flow actions (create/edit/reorder/remove/duplicate/archive)    | todo   | —   | —        |
| P2-06 | Publish action (version freeze)                                | todo   | —   | —        |
| P2-07 | Flow library `(app)/flows`                                     | todo   | —   | —        |
| P2-08 | Flow builder `(app)/flows/[id]/edit`                           | todo   | —   | —        |
| P2-09 | Shared step form renderer                                      | todo   | —   | —        |
| P2-10 | Seed script: Standard + Courier flows                          | todo   | —   | —        |
| P2-11 | Audit rows for flow actions                                    | todo   | —   | —        |

## Phase 3 — Invoices, step completion, documents

| ID    | Work item                                                         | Status | PR  | Evidence                                                                                                                                                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-01 | Migration 003: `invoices`, `invoice_steps`, `documents`           | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-02 | RLS: invoices/steps/documents                                     | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-03 | New-invoice form                                                  | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-04 | Step completion server action                                     | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-05 | Storage adapter interface + local implementation + contract tests | doing  | —   | Local adapter implemented (`src/server/storage/index.ts`) with path-traversal guard and a production refusal check; unit tests in `tests/unit/storage.test.ts`. Still needed: the shared cross-provider contract test suite referenced by the plan, to be reused when a second (Drive/R2) adapter lands in `P5-15`. |
| P3-06 | Upload action                                                     | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-07 | Download route `api/files/[id]`                                   | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-08 | Invoice detail `(app)/invoices/[id]`                              | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-09 | Manual-email step behaviour                                       | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-10 | Basic invoices list `(app)/invoices`                              | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-11 | Audit rows for invoice actions                                    | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |
| P3-12 | End-to-end script (Admin/Builder/Viewer)                          | todo   | —   | —                                                                                                                                                                                                                                                                                                                   |

## Phase 4 — Overview, history, reminders, delete/undo

| ID    | Work item                    | Status | PR  | Evidence                                   |
| ----- | ---------------------------- | ------ | --- | ------------------------------------------ |
| P4-01 | Invoices list tabs + filters | todo   | —   | —                                          |
| P4-02 | Waiting/Overdue definitions  | todo   | —   | —                                          |
| P4-03 | Dashboard `(app)/dashboard`  | todo   | —   | Placeholder page exists; no real data yet. |
| P4-04 | Storage/backup health card   | todo   | —   | —                                          |
| P4-05 | Invoice history panel        | todo   | —   | —                                          |
| P4-06 | In-app reminders             | todo   | —   | —                                          |
| P4-07 | Soft delete action           | todo   | —   | —                                          |
| P4-08 | Undo action                  | todo   | —   | —                                          |
| P4-09 | Purge job (Vercel Cron)      | todo   | —   | —                                          |
| P4-10 | Empty/loading/error states   | todo   | —   | —                                          |
| P4-11 | Mobile layouts               | todo   | —   | —                                          |

## Phase 5 — Profiles, hardening, go-live gates

| ID    | Work item                                                 | Status | PR  | Evidence                                                                                                                       |
| ----- | --------------------------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------------------------------------------ |
| P5-01 | Migration 004: `company_profile`, `company_bank_accounts` | todo   | —   | —                                                                                                                              |
| P5-02 | Field encryption module (AES-256-GCM)                     | todo   | —   | —                                                                                                                              |
| P5-03 | Company profile `(app)/company`                           | todo   | —   | —                                                                                                                              |
| P5-04 | My profile `(app)/profile`                                | todo   | —   | —                                                                                                                              |
| P5-05 | Team, roles and storage tab                               | todo   | —   | —                                                                                                                              |
| P5-06 | Security test suite (per-role matrix)                     | todo   | —   | —                                                                                                                              |
| P5-07 | Security headers, CSRF, upload sniffing                   | doing  | —   | Basic headers set in `next.config.ts` (not yet matrix-tested — see Wave E).                                                    |
| P5-08 | Dependency and secret scanning in CI                      | doing  | —   | `security.yml` runs gitleaks + dependency audit; CodeQL enabled via GitHub default setup is an owner Settings action (Wave C). |
| P5-09 | **Gate:** backups + restore drill                         | todo   | —   | —                                                                                                                              |
| P5-10 | Hosting decision (Vercel Hobby)                           | done   | —   | `DECISIONS.md` D5.                                                                                                             |
| P5-11 | Retention decision (Admin-only delete, no sign-off)       | done   | —   | `DECISIONS.md`.                                                                                                                |
| P5-12 | Privacy pass for personal data                            | todo   | —   | —                                                                                                                              |
| P5-13 | Go-live runbook                                           | todo   | —   | Full runbook lives in **local private notes**, outside this repo (see `DECISIONS.md`).                                         |
| P5-14 | Clean production data                                     | todo   | —   | —                                                                                                                              |
| P5-15 | **Gate:** reliable file storage (Cloudflare R2)           | todo   | —   | Provider locked to R2 (`DECISIONS.md`); implement via B9-08a–h.                                                                |

## Phase 6 — Agentic layer (Release 2) — not started, gated

Phase 6 gates (Release 1 live + 4-week usage + `P6-01` decisions + owner go-ahead)
are not met. No agent tables, routes, or settings exist, per plan rule 8. All
rows below are `todo` and must stay that way until the gates are ticked in
`DECISIONS.md`.

| ID    | Work item                                                         | Status |
| ----- | ----------------------------------------------------------------- | ------ |
| P6-01 | Owner decisions: model provider, cap, privacy, first capabilities | todo   |
| P6-02 | Migration 005: agent tables                                       | todo   |
| P6-03 | RLS/grants for agent tables                                       | todo   |
| P6-04 | Model gateway + redaction filter                                  | todo   |
| P6-05 | Agent tool registry                                               | todo   |
| P6-06 | Agent settings screen                                             | todo   |
| P6-07 | Proposal engine                                                   | todo   |
| P6-08 | Review queue                                                      | todo   |
| P6-09 | Document reading job                                              | todo   |
| P6-10 | Invoice with agent screen                                         | todo   |
| P6-11 | Ask the agent + Agent home                                        | todo   |
| P6-12 | Agent activity                                                    | todo   |
| P6-13 | Agent reminders                                                   | todo   |
| P6-14 | Flow drafting                                                     | todo   |
| P6-15 | Review notification                                               | todo   |
| P6-16 | Evaluation set + thresholds                                       | todo   |
| P6-17 | Agent security tests                                              | todo   |
| P6-18 | Gradual rollout + runbook update                                  | todo   |

## Phase 7 — Later (optional, needs explicit go-ahead per item)

| Item                                    | Status |
| --------------------------------------- | ------ |
| Two-step sign-in                        | todo   |
| Email reminders / automated emails      | todo   |
| Search over documents (pgvector)        | todo   |
| Virus scanning                          | todo   |
| Storage provider move (e.g. R2 → other) | todo   |
| Hosting/database move                   | todo   |

---

## Backend-first (B*/U*) tracking

Source: [`docs/invoice-tracker-backend-first-task-breakdown.md`](docs/invoice-tracker-backend-first-task-breakdown.md)
plus R2 guide [`docs/invoice-tracker-cloudflare-r2-agent-guide.md`](docs/invoice-tracker-cloudflare-r2-agent-guide.md).
P↔B map: P0≈B0, P1≈B1+B2+B3, P2≈B4, P3≈B5+B6, P4≈B7, P5≈B8+B9, UI≈U*.

### Phase B0 — Repo, guardrails, CI

| ID    | Status | Evidence                                                                                                                 |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| B0-01 | done   | `DECISIONS.md` D1–D5 + 14 Oct 2026: Builder publish, waiting=3d, field types, R2 go-live. Neon region settled (B0-12).   |
| B0-02 | done   | Next.js App Router, TS strict, pnpm, `.nvmrc`, folder layout (Wave B1).                                                  |
| B0-03 | done   | `@/server` ban is error; `pnpm check:server-import-ban`.                                                                 |
| B0-04 | done   | `ci.yml` green on PR #2 (run `38202156752`).                                                                             |
| B0-05 | done   | `pnpm audit --prod --audit-level=high` fails CI on high/critical.                                                        |
| B0-06 | done   | Ruleset + PR template (Wave C).                                                                                          |
| B0-07 | done   | `.gitignore`, `.env.example`, `check:public-env`, `SECURITY.md`.                                                         |
| B0-08 | done   | `pnpm check:no-ai` + CI step; unit tests for planted violations.                                                         |
| B0-09 | done   | `src/server/kernel/*`; logger redacts password (`tests/unit/kernel/`).                                                   |
| B0-10 | done   | `src/server/env.ts` Zod loader; local/R2 conditional; unit tests.                                                        |
| B0-11 | done   | `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.cursorignore`, `CONTRIBUTING.md`.                                   |
| B0-12 | done   | Dual Neon regions (2026-10-20): Singapore for local/Preview, `aws-us-east-2` for Production; see `DECISIONS.md` + P0-03. |
| B0-13 | done   | Local storage + `pnpm storage:smoke`.                                                                                    |
| B0-14 | done   | `docker-compose.yml`, `tests/db/*` placeholder, CI `db-tests` job with postgres:16.                                      |
| B0-15 | done   | `/api/health` + `/health` re-export; e2e hits `/api/health`.                                                             |
| B0-16 | done   | This section + P* rows; private notes outside repo (`DECISIONS.md`).                                                     |

### Phase B1 — Database foundation

| ID    | Status | Evidence                                                                                     |
| ----- | ------ | -------------------------------------------------------------------------------------------- |
| B1-01 | done   | `0000_b1_schema.sql`: citext/pgcrypto, `user_role`, `users`, `one_admin`.                    |
| B1-02 | done   | `sessions` + `login_attempts`.                                                               |
| B1-03 | done   | `audit_log`.                                                                                 |
| B1-04 | done   | `0001_b1_triggers_roles_rls.sql` creates `app_user`, grants, revokes audit UPDATE/DELETE.    |
| B1-05 | done   | `flow_templates` / `flow_versions` / `flow_steps`.                                           |
| B1-06 | done   | Trigger blocking edits to published steps.                                                   |
| B1-07 | done   | `invoices` + indexes.                                                                        |
| B1-08 | done   | `invoice_steps` + forward-only / in-order triggers.                                          |
| B1-09 | done   | `documents` (no bytea).                                                                      |
| B1-10 | done   | `company_profile` singleton + one active default bank.                                       |
| B1-11 | done   | `reminder_state` + `user_preferences`.                                                       |
| B1-12 | done   | RLS on `users`.                                                                              |
| B1-13 | done   | RLS on flow tables.                                                                          |
| B1-14 | done   | RLS on invoices / invoice_steps / documents.                                                 |
| B1-15 | done   | RLS on company + bank + audit.                                                               |
| B1-16 | done   | `src/server/db/schema.ts`, `drizzle.config.ts`, `pnpm db:check-drift`, CI `migration-drift`. |
| B1-17 | done   | `pnpm db:seed` — synthetic users + Standard/Courier raw fixtures.                            |

Tests: `tests/db/constraints.test.ts`, `tests/db/rls.test.ts` (CI `db-tests`).

### Phase B2 — Security primitives

| ID    | Status | Evidence                                                                                                          |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| B2-01 | done   | `src/server/security/password.ts` + unit tests                                                                    |
| B2-02 | done   | `src/server/security/session.ts` + unit tests. TTL updated 21 Oct 2026: absolute + idle = 24h (see DECISIONS.md). |
| B2-03 | done   | `src/server/security/rate-limit.ts` decision tests                                                                |
| B2-04 | done   | `src/server/security/crypto.ts` AES-256-GCM round-trip                                                            |
| B2-05 | done   | `scripts/rotate-encryption-key.ts` (`pnpm crypto:rotate`)                                                         |
| B2-06 | done   | `src/server/db/with-user.ts`                                                                                      |
| B2-07 | done   | `src/server/audit/write.ts` + redaction tests                                                                     |
| B2-08 | done   | `src/server/authz` requireRole / requireStepRole / canSeeInvoice                                                  |
| B2-09 | done   | CSP/headers + CSRF helpers + `pnpm check:security-headers`                                                        |
| B2-10 | done   | `src/proxy.ts` cookie gate (Next 16 rename from `middleware.ts`)                                                  |
| B2-11 | done   | `requireCronSecret`                                                                                               |
| B2-12 | done   | `tests/security/role-matrix.ts` sample row                                                                        |

### Phase B3 — Identity

| ID    | Status | Evidence                                                                                                                                                               |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B3-01 | done   | `src/server/auth/service.ts` `login`. Tests: `auth.login decision paths (B3-01)` — good / bad / unknown-user (dummy hash) / inactive / rate-limited.                   |
| B3-02 | done   | `logout`, `logoutAll`, `resolveSession` (touches `last_seen_at` via session primitive).                                                                                |
| B3-03 | done   | `src/app/api/auth/login/route.ts`, `logout/route.ts` + `auth/cookies.ts`. Tests: `session cookie helper (B3-03)`, `POST /api/auth/login (B3-03)` (cookie flags + 401). |
| B3-04 | done   | `scripts/bootstrap-admin.ts` + `pnpm db:bootstrap`. Second run exits non-zero when an Admin already exists.                                                            |
| B3-05 | done   | `users.create` (Builder/Viewer only, temp password, `must_change_password`). Tests: `users.create role checks (B3-05)`.                                                |
| B3-06 | done   | `users.list` / `users.get` with phone/email only for Admin or self (`projectUser`).                                                                                    |
| B3-07 | done   | `users.deactivate` / `reactivate`; Admin deactivate refused; sessions revoked on deactivate.                                                                           |
| B3-08 | done   | `users.resetPassword` — temp password, force change, revoke sessions.                                                                                                  |
| B3-09 | done   | `users.changeOwnPassword` — verify old; revoke other sessions (keep current when `currentSessionId` set).                                                              |
| B3-10 | done   | `users.transferAdmin` single tx (demote then promote); `one_admin` count checked; audit row.                                                                           |
| B3-11 | done   | `users.updateOwnProfile` (name/email/phone/photo/prefs); cannot change role.                                                                                           |
| B3-12 | done   | `listOwnSessions` / `revokeOwnSession` in auth service.                                                                                                                |
| B3-13 | done   | API routes under `src/app/api/users/**`, `src/app/api/me/**` + `src/server/actions/users.ts` (cookie-resolved ctx, Zod).                                               |
| B3-14 | done   | `tests/security/role-matrix.ts` appends all B3 ops; harness expects 0 unexpected allows.                                                                               |

### Phase B4 — Flow engine

| ID    | Status | Evidence                                                                                                    |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------- |
| B4-01 | done   | `src/server/flows/schema.ts` + fixtures. Tests: `flow fields schema (B4-01)`.                               |
| B4-02 | done   | `validateStepData`. Tests: `validateStepData (B4-02)`.                                                      |
| B4-03 | done   | `createDraft` / `duplicate`. Role matrix `flows-mutate`. DB: `tests/db/flows.test.ts`.                      |
| B4-04 | done   | `addStep` / `editStep` / `removeStep` / `reorderSteps` draft-only.                                          |
| B4-05 | done   | `publish` freezes draft; edits fork new draft.                                                              |
| B4-06 | done   | `archive` + `canStartNewInvoices` / `assertCanStartNewInvoices`.                                            |
| B4-07 | done   | `list` / `get` with step chips, status, published version, active invoice count.                            |
| B4-08 | done   | `diffAgainst` returns 1-based differing step numbers.                                                       |
| B4-09 | done   | `seedStandardAndCourierFlows` via service; `scripts/seed.ts` updated.                                       |
| B4-10 | done   | Handlers + `actions/flows.ts` + `/api/flows/*`. Tests: `flow handlers (B4-10)`, `flows API routes (B4-10)`. |
| B4-11 | done   | Audit on create/edit/publish/archive. Role matrix rows `flows-mutate`, `flows-read`.                        |

### Phase B5 — Invoices + steps

| ID    | Status | Evidence                                                                                    |
| ----- | ------ | ------------------------------------------------------------------------------------------- |
| B5-01 | done   | `src/server/money/money.ts`. Tests: `money utils (B5-01)`.                                  |
| B5-02 | done   | `src/server/invoices/schema.ts`. Tests: `invoice schemas (B5-02)`.                          |
| B5-03 | done   | `invoices.create` pins latest published `flow_version_id`. DB: `tests/db/invoices.test.ts`. |
| B5-04 | done   | `invoices.update` non-flow fields only.                                                     |
| B5-05 | done   | `steps.complete` — role, order, `validateStepData`.                                         |
| B5-06 | done   | `src/server/invoices/status.ts`. Tests: `invoice status derivation (B5-06)`.                |
| B5-07 | done   | `invoices.get`; soft-delete → NotFound for non-Admin.                                       |
| B5-08 | done   | `email-rule.ts`. Tests: `manual-email rule (B5-08)`.                                        |
| B5-09 | done   | Handlers + `actions/invoices.ts` + `/api/invoices/*` (create/get/update/complete).          |
| B5-10 | done   | Audit on create/update/step.complete. Role matrix: `invoices.*`, `steps.complete`.          |
| B5-11 | done   | DB: flow-version pinning survives republish.                                                |

### Phase B6 — Documents + storage

| ID    | Status | Evidence                                                                                                                                                                |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B6-01 | done   | `StorageAdapter` is `put`/`getStream`/`delete`/`exists`/`healthCheck`; keys are document IDs (`documents/` prefix); `getStorageAdapter()` local; refuses `r2` until B9. |
| B6-02 | done   | Contract suite in `tests/storage/contract.ts` runs against in-memory fake + local temp dir (`pnpm test`).                                                               |
| B6-03 | done   | Local adapter: path-traversal refuse; refuses `NODE_ENV=production` and `VERCEL_ENV=production`+`STORAGE_PROVIDER=local`.                                               |
| B6-04 | done   | `validate-upload.ts`: magic bytes (pdf/png/jpeg/docx/xlsx), 10 MB cap, `sha256`, `findDuplicateByHash`; `tests/unit/validate-upload.test.ts`.                           |
| B6-05 | done   | `documents.upload` — validate, sha256 dedupe, orphan cleanup. DB: `tests/db/documents.test.ts`.                                                                         |
| B6-06 | done   | `documents.download` — stream + audit `document.view`.                                                                                                                  |
| B6-07 | done   | `GET /api/files/[id]` + `POST /api/files/upload`. Tests: `files API routes (B6-07)`.                                                                                    |
| B6-08 | done   | Role matrix `documents.upload` / `documents.download`. Schema test `documents has no bytea column`.                                                                     |

### Phase B7 — Overview, reminders, jobs

| ID    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B7-01 | done   | `invoices.list` tabs All/Mine/Waiting/Overdue/Completed + filters/sort/keyset. Tests: `invoices.list tab/filter logic (B7-01)`.                                                                                                                                                                                                                                     |
| B7-02 | done   | List indexes already in `0002_b1_list_indexes.sql` (from B5/B6 stack). **EXPLAIN intent:** list keyset → `invoices_created_at_id_idx`; date range → `invoices_issue_date_idx`; history → `audit_log_entity_id_at_idx`; purge candidates → `invoices_deleted_at_idx`; shared-key purge → `documents_object_key_idx`. Full 5k seed + timed EXPLAIN deferred to B9-03. |
| B7-03 | done   | `dashboard.counts` with 45s in-memory cache (`DASHBOARD_COUNTS_CACHE_TTL_MS`).                                                                                                                                                                                                                                                                                      |
| B7-04 | done   | `dashboard.byStep`, `needsAttention`, `recentActivity`. Wired via `GET /api/dashboard`.                                                                                                                                                                                                                                                                             |
| B7-05 | done   | `history.forInvoice` newest-first; RLS expanded in `0003_b7_audit_select.sql` for invoice-tied audit rows; non-admin action allow-list.                                                                                                                                                                                                                             |
| B7-06 | done   | `reminders.compute` waiting > N days + due soon; prefs/dismissals. Tests: `reminders.compute rules (B7-06)`.                                                                                                                                                                                                                                                        |
| B7-07 | done   | `invoices.softDelete` Admin only; hides invoice+documents; audit `invoice.softDelete`. Role matrix `invoices.softDelete`.                                                                                                                                                                                                                                           |
| B7-08 | done   | `undo` within 30 days; `listDeleted` with days left. Tests: `invoice undo window (B7-08)` day 29 / day 31.                                                                                                                                                                                                                                                          |
| B7-09 | done   | `runPurge`: adapter delete only when no live docs share `object_key`; then rows; dry-run; retention = `UNDO_RETENTION_DAYS`; audit never purged. Tests: `purge job settings (B7-09)`.                                                                                                                                                                               |
| B7-10 | done   | `/api/cron/purge`, `/api/cron/reminders` + `requireCronSecret`; `vercel.json` crons. Tests: `cron routes (B7-10)` 401 without secret.                                                                                                                                                                                                                               |
| B7-11 | done   | `health.check`: DB `select 1`, storage `healthCheck` (≥5 min cache), `SUM(size_bytes)`, `backupStatus: "none"`. `GET /api/health?full=1`. Tests: `health.check (B7-11)`. Class A/B ops alerts completed in B9-08g.                                                                                                                                                  |
| B7-12 | done   | Handlers/actions + routes for list/dashboard/history/reminders/delete/undo; role matrix B7 rows. Tests: `B7 handlers auth gates (B7-12)`.                                                                                                                                                                                                                           |

### Phase B8 — Company + encryption usage

| ID    | Status | Evidence                                                                                                                                                                                  |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B8-01 | done   | `company.get/update` in `src/server/company/`; GSTIN plain, PAN encrypted; non-Admin omits `pan`. Tests: `company.get / update (B8-01)`, `company schemas (B8-01..02)`.                   |
| B8-02 | done   | Bank add/edit/deactivate/setDefault; account number + IFSC encrypted; IFSC format check; Viewer denied. Tests: `company.listBanks (B8-02)`, IFSC cases in schema tests.                   |
| B8-03 | done   | `company.summary` — current Admin + role counts via `users.list`.                                                                                                                         |
| B8-04 | done   | Handlers + `actions/company.ts` + `/api/company/**`. Role matrix rows `company.*`. Tests: `company handlers (B8-04)`.                                                                     |
| B8-05 | done   | `tests/security/taint-guard.test.ts` — scans repos for careless `select()` / ciphertext aliases; asserts DTOs exclude hash/ciphertext. Users list uses safe columns (no `password_hash`). |

### Phase B9 — Hardening + R2 gate

| ID     | Status  | Evidence                                                                                                                                                                                                                                                                                             |
| ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B9-01  | done    | `ROLE_MATRIX` + `ROLE_MATRIX_EXPECTED_IDS` cover auth/users/flows/invoices/steps/documents/dashboard/history/reminders/company/health/cron/jobs (`tests/security/role-matrix.ts`). Test `role matrix (B2-12 / B9-01)` asserts full id set; 0 unexpected allows. RLS raw SQL: `tests/db/rls.test.ts`. |
| B9-02  | done    | `pnpm check:security-headers` prints headers + asserts cookie flags; unit `session cookie flags (B9-02)` + existing headers/cookies tests.                                                                                                                                                           |
| B9-03  | done    | `scripts/perf-smoke.ts` + `pnpm perf:smoke`; methodology + placeholder table in `docs/perf-notes.md` (live 5k numbers = owner/local against seeded DB).                                                                                                                                              |
| B9-04  | done    | `tests/db/concurrency.test.ts` — double step-complete (conditional `status='open'` update) + transferAdmin race sketch; `skipIf` without DB.                                                                                                                                                         |
| B9-05  | done    | `docs/api-contract.md` — every service op with inputs/outputs/errors/roles for UI agents.                                                                                                                                                                                                            |
| B9-06  | done    | `docs/privacy-fields.md` — field-by-field personal data visibility (redacted public).                                                                                                                                                                                                                |
| B9-07  | blocked | Owner: backup design + restore drill (private notes). Do not invent secrets.                                                                                                                                                                                                                         |
| B9-08a | blocked | Owner: Cloudflare R2 account, billing alert, provisioning token (private).                                                                                                                                                                                                                           |
| B9-08b | blocked | Owner: production bucket create/secure; paste `lifecycle list` / `dev-url get` evidence here.                                                                                                                                                                                                        |
| B9-08c | blocked | Owner: bucket-scoped `R2_*` in Vercel env; secret scan clean.                                                                                                                                                                                                                                        |
| B9-08d | done    | `src/server/storage/r2.ts` + `getStorageAdapter()` for `STORAGE_PROVIDER=r2`; `@aws-sdk/client-s3`; unit `R2StorageAdapter (B9-08d)` with mocked client.                                                                                                                                             |
| B9-08e | partial | Workflow `.github/workflows/r2-contract.yml` (`workflow_dispatch` only) + `tests/storage/r2-live.contract.test.ts`. Live green run **blocked** on B9-08b/c secrets.                                                                                                                                  |
| B9-08f | done    | File route Cache-Control asserted in `files API routes (B6-07)` + `purge job settings (B7-09 / B9-08f)` shared-key + header tests.                                                                                                                                                                   |
| B9-08g | done    | Migration `0004_b9_storage_ops_daily.sql` (after `0003_b7_audit_select`); adapters increment via `ops-counter`; `health.check` alerts at 70%/90% Class A/B and storage &gt;8GB. Tests: `health.check (B7-11)` alert case.                                                                            |
| B9-08h | blocked | Owner: go-live `STORAGE_PROVIDER=r2` + E2E upload/download/delete.                                                                                                                                                                                                                                   |
| B9-08i | blocked | Owner: backup to second provider (with B9-07).                                                                                                                                                                                                                                                       |
| B9-09  | blocked | Owner: private runbook sign-off.                                                                                                                                                                                                                                                                     |
| B9-10  | blocked | Owner: repo mirror/bundle + full history re-scan (Wave A gitleaks clean only so far).                                                                                                                                                                                                                |
| B9-11  | blocked | Owner: tick `docs/backend-freeze-checklist.md` then push tag `backend-freeze` (agents must not tag).                                                                                                                                                                                                 |

### UI (U1–U5) — after `backend-freeze`

Landed on `feat/u1-u5-ui` (stacked PR). Owner freeze tag (B9-11) remains blocked; UI ships against merged B0–B9 backend.

| ID    | Status | Evidence                                                                                                                                                                                                                          |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1-01 | done   | `src/app/globals.css` brand-blue tokens + atmosphere gradient; root layout loads DM Sans + Fraunces via `next/font`.                                                                                                              |
| U1-02 | done   | `src/app/(app)/layout.tsx` + `AppShell` role nav (Dashboard/Invoices/Flows/Company/Profile; Admin +Users/Settings); no Agent group; Sign out → `POST /api/auth/logout`. Session via `requireCurrentUser` (`src/actions/auth.ts`). |
| U1-03 | done   | `src/components/ui/`: Table, Tabs, FilterBar, Stepper, StatusChip, EmptyState, LoadingState, ErrorState, ConfirmDialog.                                                                                                           |
| U1-04 | done   | `src/components/forms/`: FormField, FieldError, `fieldErrorsFromZod` / `fieldErrorsFromServer`.                                                                                                                                   |
| U1-05 | done   | `src/components/steps/StepForm.tsx` renders file/text/confirm/date/number from flow fields JSON.                                                                                                                                  |
| U1-06 | done   | Shell CSS collapses sidebar &lt;768px; `overflow-x: hidden` on shell; placeholder routes wired under `(app)/`. Middleware matchers include `/profile` and `/users`.                                                               |
| U2-01 | done   | `(auth)/login` username/password form → `POST /api/auth/login`; generic error + Admin reset note; signed-in users redirected away (middleware + page).                                                                            |
| U2-02 | done   | `/change-password` forced when `mustChangePassword`; `POST /api/me/password`; app shell redirects until changed. Middleware allows `/login` + `/change-password`.                                                                 |
| U2-03 | done   | `/users` Admin table (list/add/deactivate/reactivate/temp password dialog) via `src/actions/users.ts` + shared Table/ConfirmDialog.                                                                                               |
| U2-04 | done   | Transfer Admin dialog on `/users` → `users.transferAdmin`.                                                                                                                                                                        |
| U2-05 | done   | `/settings` role permission matrix + storage/backup panel (`storageProvider` + `backupStatus` from health).                                                                                                                       |
| U3-01 | done   | `/flows` library: step chips, status/version/active counts, compare select (defaults Standard+Courier) → `diffFlows` highlight. `FlowLibrary` + `src/actions/flows.ts`.                                                           |
| U3-02 | done   | `/flows/[id]/edit` step list with up/down reorder → `reorderFlowSteps`; add/remove steps.                                                                                                                                         |
| U3-03 | done   | Builder step settings (name, instructions, allowedRole) + `FieldsEditor` add/remove file/text/confirm/date/number → `editFlowStep`.                                                                                               |
| U3-04 | done   | Live `StepForm` preview + Publish (`ConfirmDialog` → `publishFlow`).                                                                                                                                                              |
| U4-01 | done   | `/invoices/new` form (invoice no, party, amount rupees, dates, owner, published flow) → `invoicesCreateAction`. Admin/Builder only.                                                                                               |
| U4-02 | done   | `/invoices` tabs (all/mine/waiting/overdue/completed) + FilterBar; state in `searchParams`; Table rows link to detail.                                                                                                            |
| U4-03 | done   | `/invoices/[id]` Stepper + current `StepForm` complete + done steps (who/when/files). `InvoiceStepDetail.fields` exposed from `buildDetail`.                                                                                      |
| U4-04 | done   | Documents column + upload to current step (`POST /api/files/upload`); download links `GET /api/files/[id]`. StepForm `onUploadFile` stores document ids.                                                                          |
| U4-05 | done   | History panel via `invoiceHistoryAction` / `history.forInvoice`.                                                                                                                                                                  |
| U4-06 | done   | `/dashboard` counts, needs attention, by step, recent activity, health card (`healthFullCheckAction` ≡ `?full=1`).                                                                                                                |
| U4-07 | done   | Reminders bell in AppShell (`remindersCompute`/`dismiss`); Admin soft-delete + undo; `/invoices/deleted` Recently deleted.                                                                                                        |
| U5-01 | done   | `/profile`: details (`usersUpdateOwnProfile`), change password, devices (`sessions.listOwn` / `revokeOwn`), reminder prefs; Profile↔Company tabs. `getOwnProfile` + current session id.                                           |
| U5-02 | done   | `/company`: legal details + summary; Admin edit; bank CRUD Admin / read-only Builder; Viewers denied bank list (privacy). Wired via `src/actions/company.ts`.                                                                     |
| U5-03 | done   | `tests/e2e/phone-width.spec.ts` — 390×844 smoke for `/login`, `/dashboard`, `/invoices`, `/flows`; asserts `scrollWidth <= innerWidth`.                                                                                           |
| U5-04 | done   | `tests/e2e/invoice-lifecycle.spec.ts` skeleton (Admin→Builder upload→Viewer); `test.skip` unless `E2E_SEEDED=1`. Runbook in `tests/e2e/README.md`.                                                                                |
| U5-05 | done   | FormField/`id` association on new-invoice + profile/company forms; button names / section labels. Checklist: `docs/a11y-notes.md`. Evidence: `pnpm typecheck` / `pnpm test` / `pnpm lint` / `pnpm format` on `feat/u1-u5-ui`.     |
