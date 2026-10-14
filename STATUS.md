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
| B4 — CI & security workflows             | `ci.yml`, `security.yml`, `scorecard.yml`                                                                                                     | **done**                      | 2026-10-12 follow-up pass (authenticated `gh` session): found and fixed two further bugs beyond the ruleset-enforcement fix. (1) Actions allow-list patterns (`actions/checkout`, etc.) were missing `@ref` wildcards, so GitHub silently rejected every SHA-pinned action despite it being "in the list" — confirmed via the rejection annotation on `scorecard.yml` run `38200973959`, fixed via `PUT .../actions/permissions/selected-actions` (added `@*` to each pattern), re-verified green (`scorecard` run `38201109877`, 25s success). (2) The ruleset's required check `ci` could never be satisfied because the `ci.yml` job's display name was `"lint, typecheck, unit tests, build"`, not `ci` — every PR was stuck `mergeStateStatus: BLOCKED` even at 100% green; fixed with a one-line job-name rename (commit `256dbee`). Proof: PR #2 (https://github.com/Utsav2408/chopda/pull/2) — `ci` (run `38202156752`), `security`'s three jobs (run `38202156746`), and CodeQL's two analyses (run `38202154083`) all `success`, `mergeStateStatus: CLEAN`. Full detail in `docs/wave-c-owner-checklist.md` §1 and §4. |
| B5 — Pre-commit hook                     | `.githooks/pre-commit` (gitleaks + lint), `core.hooksPath` wiring                                                                             | **done**                      | `pnpm install` runs `scripts/setup-git-hooks.mjs`, which sets `git config core.hooksPath .githooks`. Verified locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| B6 — Agent config                        | `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.cursorignore`                                                                            | **done**                      | Files present; no account names or private URLs in any of them (reviewed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| B7 — Local env & storage                 | `.env.example`, `FILE_STORAGE_DIR` gitignored, storage smoke script                                                                           | **done**                      | `pnpm storage:smoke` passes (write/read/delete + gitignore check) against a temp dir. Owner still needs to point a real local `.env` at a Neon **dev** branch with fake data (see `DECISIONS.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C — GitHub & Vercel Settings (manual UI) | Ruleset, security settings, Actions settings, Vercel project + env vars + preview auth                                                        | **done**                      | **GitHub (§1–7):** settled 2026-10-12 via authenticated `gh` (see prior evidence / PR #2). **Vercel (§8–11):** settled same day via authenticated Vercel MCP + HTTP probes (CLI installed locally but was logged out; MCP used instead). Project `chopda` is Next.js / Node 24, linked to this GitHub repo; Hobby personal account (owner-confirmed). Env keys present for Production+Preview (names/targets only — values not read): `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `STORAGE_PROVIDER`, `CRON_SECRET`. Vercel Authentication on (`ssoProtection` for all except custom domains): unauthenticated Preview `/health` → HTTP 302 SSO; Production `/health` → HTTP 200 `{"status":"ok","service":"chopda",...}`. Soft notes for later: prefer separate Preview secrets before real data; confirm Production `STORAGE_PROVIDER` is not `local` before uploads (`P5-15`). Full write-up: [`docs/wave-c-owner-checklist.md`](docs/wave-c-owner-checklist.md) §8–11.                                                                                                                                               |
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

| ID    | Work item                                                                           | Status | PR                                               | Evidence                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-01 | Owner decisions (D1–D5) copied into `DECISIONS.md`                                  | done   | —                                                | `DECISIONS.md`                                                                                                                                                                                                                                                                                                                                             |
| P0-02 | Git repo + Next.js (App Router, TS), lint, format, Vitest, Playwright, CI workflow  | done   | [#2](https://github.com/Utsav2408/chopda/pull/2) | Scaffold done, local checks green (see Wave B1 above). First push 2026-10-12 (`aacad8d`) hit CI `startup_failure`; follow-up pass same day fixed the Actions allow-list and required-check-name bugs — `ci` now runs and passes for real (PR #2, run `38202156752`, `mergeStateStatus: CLEAN`). See Wave B4 above and `docs/wave-c-owner-checklist.md` §4. |
| P0-03 | Neon project created; connection strings in Vercel + local env only                 | todo   | —                                                | Owner action: create Neon project (Wave C).                                                                                                                                                                                                                                                                                                                |
| P0-04 | Local file storage folder + `FILE_STORAGE_DIR`/`STORAGE_PROVIDER=local`, gitignored | doing  | —                                                | Adapter + `pnpm storage:smoke` pass against a temp dir. Owner still needs to point `.env.FILE_STORAGE_DIR` at a real folder outside the repo.                                                                                                                                                                                                              |
| P0-05 | Vercel project from repo; env vars set; preview deploy loads health page            | done   | —                                                | 2026-10-12: Vercel project linked; required env keys present (Production+Preview); Production `/health` returned ok; Preview `/health` gated by Vercel Authentication (302 SSO). Evidence detail in `docs/wave-c-owner-checklist.md` §8–11 (no production URLs/IDs here).                                                                                  |
| P0-06 | `.env.example`, README, `STATUS.md` with every work item as `todo`                  | done   | —                                                | `.env.example`, `README.md`, this file.                                                                                                                                                                                                                                                                                                                    |
| P0-07 | Encryption key stored in two places outside the DB; rotation steps noted            | todo   | —                                                | Owner action, kept in **local private notes only** (not this repo) — see `DECISIONS.md`.                                                                                                                                                                                                                                                                   |

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

| ID    | Status  | Evidence                                                                                                                  |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| B0-01 | done    | `DECISIONS.md` D1–D5 + 14 Oct 2026: Builder publish, waiting=3d, field types, R2 go-live. Neon region still open (B0-12). |
| B0-02 | done    | Next.js App Router, TS strict, pnpm, `.nvmrc`, folder layout (Wave B1).                                                   |
| B0-03 | done    | `@/server` ban is error; `pnpm check:server-import-ban`.                                                                  |
| B0-04 | done    | `ci.yml` green on PR #2 (run `38202156752`).                                                                              |
| B0-05 | done    | `pnpm audit --prod --audit-level=high` fails CI on high/critical.                                                         |
| B0-06 | done    | Ruleset + PR template (Wave C).                                                                                           |
| B0-07 | done    | `.gitignore`, `.env.example`, `check:public-env`, `SECURITY.md`.                                                          |
| B0-08 | done    | `pnpm check:no-ai` + CI step; unit tests for planted violations.                                                          |
| B0-09 | done    | `src/server/kernel/*`; logger redacts password (`tests/unit/kernel/`).                                                    |
| B0-10 | done    | `src/server/env.ts` Zod loader; local/R2 conditional; unit tests.                                                         |
| B0-11 | done    | `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.cursorignore`, `CONTRIBUTING.md`.                                    |
| B0-12 | blocked | Owner: Neon project + region (does not block local/CI Postgres for B1).                                                   |
| B0-13 | done    | Local storage + `pnpm storage:smoke`.                                                                                     |
| B0-14 | done    | `docker-compose.yml`, `tests/db/*` placeholder, CI `db-tests` job with postgres:16.                                       |
| B0-15 | done    | `/api/health` + `/health` re-export; e2e hits `/api/health`.                                                              |
| B0-16 | done    | This section + P* rows; private notes outside repo (`DECISIONS.md`).                                                      |

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

### Later phases

B2–B9 and U1–U5 land in follow-up stacked PRs.
