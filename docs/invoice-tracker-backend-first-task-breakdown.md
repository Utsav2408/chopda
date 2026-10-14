# Invoice Tracker: Backend-First Task Breakdown

Draft dated 2026-10-12. Re-cuts `invoice-tracker-phasewise-implementation-plan.md` so the backend is built, secured and proven before any UI. Release 1 only (no AI). Phase 6 (agent) stays as in the original plan and is not repeated here.

## How this differs from the original plan

- **Backend first, UI second.** Phases B0 to B9 deliver a fully working, tested backend (database, services, route handlers, jobs) with no screens except a health route. Phases U1 to U5 then build screens 1 to 9 on top of frozen contracts.
- **Contract first.** Every module exposes a typed service function (Zod input, typed result, typed errors). Server actions and route handlers are thin wrappers. UI agents never touch SQL; backend agents never touch components.
- **Security pulled forward.** Encryption, audit, rate limiting, secret scanning and the role matrix test harness are built early, not at the end. The security matrix grows with each module.
- **Atomic tasks.** One task = one PR, ideally under half a day, one clear artifact, one verifiable check. Tasks in the same lane can run in parallel when their `Needs` are done.
- **Source of truth.** Docs 1 to 6 in `claude/`. The database doc wins on conflicts (no Excel import, local file folder until the reliable-store gate).

## Conventions every task follows

1. ID format `B3-04` (backend) or `U2-01` (UI). Put it in branch name, PR title and `STATUS.md`.
2. **Layering:** `src/server/<module>/service.ts` (business rules, role checks, transaction) -> `schema.ts` (Zod) -> `repo.ts` (SQL via Drizzle, called only from service). Server actions and `api/*` handlers call services only.
3. **Every service function takes `ctx: { userId, role, requestId }`** and re-checks the role itself. Never trust the caller.
4. **Error taxonomy** (B0-09): `Unauthenticated`, `Forbidden`, `NotFound`, `Validation`, `Conflict`, `RateLimited`, `Internal`. Services throw these; wrappers map them to HTTP codes or form errors. Not-found and forbidden look the same to a caller who may not know the record exists.
5. **Audit:** every mutating service calls the single audit writer inside the same transaction.
6. **Tests per task:** unit test for logic, DB test (real Postgres) for constraints/RLS/triggers, and a role-matrix entry (B2-12) for anything callable.
7. **Evidence** (command output, test name, query result) pasted in `STATUS.md`. No evidence, not done.
8. Public repo: synthetic data only; no real names, keys or account details in any file (see GitHub checklist).
9. No AI code, keys, tables or routes in this plan. A CI check (B0-08) enforces it.

**Lanes** (who can work at once): `DB` migrations and SQL, `SEC` security primitives, `SVC` services, `API` handlers and jobs, `TEST` harnesses and suites, `OPS` repo/CI/infra.

---

## Phase B0: Repo, guardrails, CI

**Start:** planning docs exist, no repo. **End:** green CI on an empty app; scanning on; agent rules in place; owner decisions logged.

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B0-01 | Owner answers open decisions into `DECISIONS.md` (roles confirmed, region, go-live file store, hosting) | OPS | none | File committed, dated |
| B0-02 | Create repo: Next.js App Router, TypeScript strict, pnpm, `.nvmrc`, lockfile, folder layout (`src/server`, `db/migrations`, `scripts`, `tests`, `docs`) | OPS | none | Fresh clone installs and builds |
| B0-03 | ESLint + Prettier + `.editorconfig`; ESLint rule banning client imports of `server-only` modules | OPS | B0-02 | Lint fails on a deliberate bad import |
| B0-04 | `ci.yml`: install frozen, lint, typecheck, unit tests, build; hardened defaults (read-only token, SHA-pinned actions, timeouts, concurrency) | OPS | B0-03 | Required check green on PR |
| B0-05 | `security.yml`: gitleaks, `npm audit --omit=dev`, dependency-review; enable CodeQL, Dependabot (npm + actions), secret scanning, push protection | OPS | B0-04 | Scan job green; settings screenshot |
| B0-06 | `main` ruleset (PR required, CI required, no force push, squash only, 0 approvals) and PR template | OPS | B0-04 | Direct push to `main` rejected |
| B0-07 | `.gitignore`, `.env.example` (server-only vars marked, no `NEXT_PUBLIC_` secrets), CI check that fails on secret-looking `NEXT_PUBLIC_` names, `SECURITY.md` | OPS | B0-02 | CI check fails on a planted bad name |
| B0-08 | CI guard: fail if repo contains agent routes, `agent_*` tables or AI vendor key names before Phase 6 | OPS | B0-04 | Planted violation fails CI |
| B0-09 | Shared kernel: typed error classes, `Result` helpers, `requestId` generator, structured logger that redacts secrets and PII | SVC | B0-02 | Unit tests; logger test shows password field redacted |
| B0-10 | Env loader with Zod: refuses to boot on missing or malformed vars; separate owner vs `app_user` DB URLs | SVC | B0-02 | Boot test with bad env fails with clear message |
| B0-11 | `AGENTS.md` (short), `CLAUDE.md` with `@AGENTS.md`, `.claude/settings.json` deny rules, `.cursorignore`, `CONTRIBUTING.md` | OPS | B0-06 | Files committed; deny rule blocks reading `.env` |
| B0-12 | Neon project and a dev branch with fake data; pooled and direct strings in local env and Vercel only | OPS | B0-01 | `select 1` from app health route |
| B0-13 | Local file folder via `FILE_STORAGE_DIR`, gitignored, created on first run | OPS | B0-02 | Scripted write/read/delete; `git status` clean |
| B0-14 | Test DB harness: Postgres service container in CI and local Docker; helper to create a blank DB, run migrations, tear down | TEST | B0-04 | One placeholder DB test passes in CI |
| B0-15 | Vercel project (personal, Hobby), env vars set, Vercel Authentication on for previews, `/api/health` route | OPS | B0-12 | Preview loads health page behind auth |
| B0-16 | `STATUS.md` with every task below as a `todo` row; private notes location chosen (key locations never in repo) | OPS | B0-02 | File present |

Parallel: B0-03/05/09/10/12/13 can run together once B0-02 lands.

---

## Phase B1: Database foundation

**Start:** B0 done. **End:** all Release 1 tables exist with constraints, triggers and RLS, proven by DB tests. Migrations are forward-only; RLS/triggers/partial indexes/citext are hand-written SQL.

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B1-01 | Migration: extensions (`citext`, `pgcrypto`), `user_role` enum, `users` with `one_admin` partial unique index | DB | B0-14 | Second admin insert fails |
| B1-02 | Migration: `sessions` (`token_hash`, `expires_at`, `last_seen_at`, `user_agent`, `ip`), `login_attempts` (username, ip, at) | DB | B1-01 | Applies to blank DB |
| B1-03 | Migration: `audit_log` append-only (actor, action, entity, entity_id, before, after, at, request_id) | DB | B1-01 | Table exists |
| B1-04 | Migration: DB roles `app_user` (limited) and owner; revoke UPDATE/DELETE on `audit_log` from `app_user`; default privileges | DB | B1-03 | `app_user` cannot update/delete audit row |
| B1-05 | Migration: `flow_templates`, `flow_versions`, `flow_steps` with unique (version, position) and JSON-object check on `fields` | DB | B1-01 | Constraint tests |
| B1-06 | Migration: trigger blocking UPDATE/DELETE on steps of a published version | DB | B1-05 | Editing a published step raises |
| B1-07 | Migration: `invoices` (`amount_minor` bigint >= 0, `deleted_at`, `extra` JSONB), partial index on (status, due_date), indexes on owner, flow, step | DB | B1-05 | Constraint tests |
| B1-08 | Migration: `invoice_steps` unique (invoice, flow_step); trigger enforcing forward-only status and in-order completion | DB | B1-07 | Out-of-order and double completion rejected in SQL |
| B1-09 | Migration: `documents` (`storage_provider`, `object_key`, `original_filename`, `sha256`, `mime_type`, `size_bytes`, `scan_status`, `uploaded_by`, `deleted_at`) | DB | B1-08 | No bytea column (schema test) |
| B1-10 | Migration: `company_profile` (single-row constraint) and `company_bank_accounts` (exactly one active default) | DB | B1-01 | Second profile and second default rejected |
| B1-11 | Migration: `reminder_state` / `user_preferences` tables for reminder dismissals and prefs | DB | B1-01 | Applies |
| B1-12 | RLS policies: `users` (Admin writes role/active; own-row profile edit; all read limited columns) | DB | B1-01, B1-04 | Per-role allow/deny DB tests |
| B1-13 | RLS policies: flow tables (all read, Admin+Builder write, Viewer denied) | DB | B1-05 | Per-role DB tests |
| B1-14 | RLS policies: invoices, invoice_steps, documents (read all roles; write Admin+Builder; `allowed_role` honoured; soft-deleted rows hidden except to Admin) | DB | B1-09 | Per-role DB tests |
| B1-15 | RLS policies: `company_profile`, bank accounts (Admin write; bank hidden from Viewer), `audit_log` (insert only; read Admin) | DB | B1-10 | Per-role DB tests |
| B1-16 | Drizzle schema typed from migrations; `migration-drift` CI job; Neon branch-per-PR DB test job | TEST | B1-09 | Drift check fails on planted unmigrated change |
| B1-17 | Seed script (synthetic): 1 admin, builders, viewers, Standard and Courier flows via service layer later; here only users + raw flow fixtures | DB | B1-05 | Seed idempotent |

Parallel: B1-01 to B1-11 chain by dependency but B1-05/B1-10/B1-11 can proceed alongside B1-02/03 once B1-01 exists. RLS tasks B1-12 to B1-15 run in parallel after their tables.

---

## Phase B2: Security primitives and request context

**Start:** B1-04 done. **End:** reusable, tested security building blocks that every service uses.

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B2-01 | Password module: argon2id hash/verify, min length, constant-time compare, rehash-on-parameter-change | SEC | B0-09 | Hash differs per call; wrong password fails |
| B2-02 | Session module: random token, store hash only, expiry (absolute + idle), revoke one/all, cookie flags helper | SEC | B1-02 | Tests for expiry, revocation, tampered token |
| B2-03 | Rate limiter in Postgres: per username and per IP, lockout window, generic result | SEC | B1-02 | Nth failure blocked, allowed after window |
| B2-04 | Field encryption: AES-256-GCM, unique nonce, key id prefix, decrypt server-only | SEC | B0-10 | Round trip; tampered value fails |
| B2-05 | Key rotation script (re-encrypt all encrypted columns, dry-run mode) | SEC | B2-04 | Rotation on seeded data leaves values readable |
| B2-06 | Request context: `withUser(ctx, fn)` opening a transaction and `SET LOCAL app.user_id/app.role`; all repos accept `tx` | SEC | B1-12 | Query sees acting user; no-ctx query fails |
| B2-07 | Audit writer: single `audit()` function, same-transaction, redacts secret fields in `before/after` | SEC | B1-03, B2-06 | One row per call; secrets absent from JSON |
| B2-08 | Authorisation helpers: `requireRole(ctx, ...roles)`, `requireStepRole`, `canSeeInvoice` | SEC | B2-06 | Unit tests per role |
| B2-09 | CSRF/origin check helper for actions and handlers; input size limits; security headers config (CSP, HSTS, frame, referrer, nosniff) | SEC | B0-02 | Header check script passes |
| B2-10 | `middleware.ts`: session presence + coarse role by route group (never the only check) | API | B2-02 | Signed-out protected URL redirects |
| B2-11 | Cron guard: `requireCronSecret()` helper, constant-time compare | SEC | B0-10 | Missing/wrong secret returns 401 |
| B2-12 | **Role-matrix test harness**: a declarative table (operation x {signed-out, viewer, builder, admin} -> expected) that every later task appends to; runs service calls and, for RLS, raw SQL as `app_user` | TEST | B2-06 | Harness runs with one sample row; CI reports unexpected allows |

Parallel: B2-01, 02, 03, 04, 09, 11 are independent.

---

## Phase B3: Identity and administration services

**End:** sign-in, sign-out, user admin and Admin transfer work through services and handlers, fully tested.

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B3-01 | `auth.login(username, password, ip, ua)`: rate-limit check, verify, create session, audit; generic error; timing-safe for unknown users | SVC | B2-01, 02, 03, 07 | Good, bad, unknown-user, locked cases tested |
| B3-02 | `auth.logout`, `auth.logoutAll`, `auth.resolveSession(token)` (updates `last_seen_at`) | SVC | B2-02 | Revoked token no longer resolves |
| B3-03 | Login/logout route handlers and cookie wiring | API | B3-01, 02, 2-10 | HTTP tests incl. cookie flags |
| B3-04 | Bootstrap script: create the single Admin from env input, refuses second run | SVC | B1-01, B2-01 | Second run exits non-zero |
| B3-05 | `users.create` (Builder/Viewer only), temporary password generation, `must_change_password` flag | SVC | B2-08 | Admin only; creating admin refused |
| B3-06 | `users.list`, `users.get` with column-level visibility (phone/email to Admin and self only) | SVC | B1-12 | Viewer sees no phone/email of others |
| B3-07 | `users.deactivate/reactivate` (Admin cannot be deactivated); revokes sessions | SVC | B3-05 | Admin deactivate refused |
| B3-08 | `users.resetPassword` (one-time temp password, forces change, revokes sessions) | SVC | B3-05 | Old sessions dead |
| B3-09 | `users.changeOwnPassword` (verify old, revoke other sessions) | SVC | B2-01, B2-02 | Other sessions revoked |
| B3-10 | `users.transferAdmin` single transaction; old Admin becomes Builder; index invariant holds | SVC | B3-05 | Exactly one admin before and after; audit row |
| B3-11 | `users.updateOwnProfile` (name, email, phone, photo reference, prefs) | SVC | B1-12 | Cannot edit others or role |
| B3-12 | `sessions.listOwn`, `sessions.revokeOwn(id)` | SVC | B2-02 | Cannot revoke another user's session |
| B3-13 | Handlers/actions for B3-05 to B3-12 (thin wrappers, Zod, error mapping) | API | B3-05..12 | HTTP tests per op |
| B3-14 | Append all B3 operations to the role matrix | TEST | B2-12 | 0 unexpected allows |

Parallel: B3-05 to B3-12 are independent after B3-05's helper.

---

## Phase B4: Flow engine services

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B4-01 | Zod schema for `fields` (`file`, `text`, `confirm`, optional `date`, `number`), unique keys, `required`, max counts and lengths | SVC | B0-09 | Valid/invalid fixtures |
| B4-02 | Shared `validateStepData(fields, data)` used by flows now, invoices later | SVC | B4-01 | Missing required, wrong type, extra keys rejected |
| B4-03 | `flows.createDraft`, `flows.duplicate` | SVC | B1-13, B2-08 | Role matrix rows |
| B4-04 | `flows.addStep/editStep/removeStep/reorderSteps` (draft only) | SVC | B4-03, B4-01 | Published steps refused by service and DB |
| B4-05 | `flows.publish`: freeze as version N+1 in one transaction; later edits start a new draft | SVC | B4-04, B1-06 | Publish twice gives v1 and v2; v1 byte-identical |
| B4-06 | `flows.archive`; archived flows can't start new invoices but running ones continue | SVC | B4-05 | Test |
| B4-07 | `flows.list` (with step chips data, state, version, active invoice count) and `flows.get` | SVC | B4-05 | Counts match SQL |
| B4-08 | `flows.diffAgainst(otherFlowId)` returning which step positions differ (powers the highlight) | SVC | B4-07 | Standard vs Courier differs at step 4 only |
| B4-09 | Seed Standard and Courier flows through the service layer | SVC | B4-05 | Both published; diff = step 4 |
| B4-10 | Handlers/actions for flows | API | B4-03..08 | HTTP tests |
| B4-11 | Audit for flow create/edit/publish/archive; role matrix rows | TEST | B2-12 | 0 unexpected allows |

---

## Phase B5: Invoice and step engine

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B5-01 | Money utils: rupees string <-> paise bigint, no floats, rejects >2 decimals | SVC | B0-09 | Round-trip property test |
| B5-02 | Zod schemas for invoice create/update (unique number, dates, owner, flow) | SVC | B5-01 | Fixtures |
| B5-03 | `invoices.create`: Admin/Builder; pins `flow_version_id`; creates `invoice_steps`; sets `current_step_id` | SVC | B1-14, B4-05 | Pinned to version at creation |
| B5-04 | `invoices.update` (non-flow fields only; flow version immutable) | SVC | B5-03 | Flow change refused |
| B5-05 | `steps.complete`: session, role, `allowed_role`, previous step done, `validateStepData`, forward-only, updates current step and invoice status, one transaction | SVC | B5-03, B4-02 | Out-of-order, repeat, missing field, wrong role all refused |
| B5-06 | Status derivation in one module: open, waiting (current step open > N days, configurable), overdue (past due, not completed), completed, cancelled | SVC | B5-05 | Boundary-day unit tests |
| B5-07 | `invoices.get` (detail with steps, who/when, document refs) with soft-delete hiding | SVC | B5-05 | Deleted returns NotFound |
| B5-08 | Manual-email rule: courier step requires `email_sent` confirmation; proof optional | SVC | B5-05 | Cannot complete without confirmation |
| B5-09 | Handlers/actions for invoices and steps | API | B5-03..08 | HTTP tests |
| B5-10 | Audit rows and role matrix entries | TEST | B2-12 | 0 unexpected allows |
| B5-11 | Flow-version-pinning regression test: edit and republish a flow, running invoice unchanged | TEST | B5-03 | Test green |

---

## Phase B6: Documents and file storage

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B6-01 | `StorageAdapter` interface (`put`, `getStream`, `delete`, `exists`, `healthCheck`); keys are document IDs | SVC | B0-09 | Types only, reviewed |
| B6-02 | Contract test suite any adapter must pass | TEST | B6-01 | Suite runs against an in-memory fake |
| B6-03 | Local-folder adapter: path-traversal protection; refuses to start when `NODE_ENV=production` | SVC | B6-02, B0-13 | Contract suite passes; prod-mode start fails |
| B6-04 | Upload validation: allowed types by magic bytes (not extension), size cap 10 MB, `sha256`, duplicate warning | SVC | B6-01 | Wrong type, oversize, spoofed extension refused |
| B6-05 | `documents.upload`: auth, role, step access; write file then insert row; orphan cleanup on failure; link document ID into step data | SVC | B6-03, 04, B5-05 | Orphan cleanup test |
| B6-06 | `documents.download` service: permission check, audit view row, returns stream or short-lived link | SVC | B6-03, B2-07 | Wrong role Forbidden |
| B6-07 | Route handlers `api/files/[id]` (GET) and upload endpoint; never serve storage folder statically; `Content-Disposition` and `nosniff` | API | B6-05, 06 | Storage path unreachable by URL |
| B6-08 | Role matrix rows and a "no bytes in Postgres" schema test | TEST | B2-12 | Green |

Parallel: B6-04 and B6-03 are independent.

---

## Phase B7: Overview, history, reminders, delete lifecycle, jobs

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B7-01 | `invoices.list` with tabs (All, Mine, Waiting, Overdue, Completed), filters (flow, step, owner, date range), sort, keyset pagination | SVC | B5-06 | Tab/filter tests |
| B7-02 | Index audit: `EXPLAIN` on each filter with 5,000 seeded invoices; add missing indexes by migration | DB | B7-01 | All use an index; each < 1 s |
| B7-03 | `dashboard.counts` (open, waiting, overdue, completed) with 30 to 60 s cache | SVC | B5-06 | Equals direct SQL |
| B7-04 | `dashboard.byStep`, `dashboard.needsAttention`, `dashboard.recentActivity` | SVC | B7-03 | Matches SQL |
| B7-05 | `history.forInvoice` from `audit_log`, newest first, role-filtered | SVC | B2-07 | Matches audit rows |
| B7-06 | `reminders.compute` (waiting > N days; payment due soon), per-user prefs and dismissals | SVC | B5-06, B1-11 | Appears, clears on completion |
| B7-07 | `invoices.softDelete` (Admin only), hides invoice and documents; audit | SVC | B5-07 | 404 on detail and file route |
| B7-08 | `invoices.undo` within 30 days; `invoices.listDeleted` with days left | SVC | B7-07 | Day 29 ok, day 31 refused |
| B7-09 | Purge job service: delete stored files through adapter first, then rows; idempotent; dry-run; retention days from one setting; audit never purged | SVC | B7-07, B6-03 | Time-shifted test; audit remains |
| B7-10 | Cron routes (`/api/cron/purge`, `/api/cron/reminders`) with secret guard; scheduler config | API | B7-09, B2-11 | 401 without secret |
| B7-11 | `health.check`: DB reachable, storage reachable and used, backup status text ("none" until B9) | SVC | B6-01 | Turns red when storage dir unreachable |
| B7-12 | Handlers/actions for list, dashboard, history, reminders, delete/undo; role matrix rows | API | B7-01..11 | HTTP tests |

---

## Phase B8: Company profile and encrypted data

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B8-01 | `company.get/update` (Admin writes; GSTIN plain, PAN encrypted); non-Admin read excludes PAN | SVC | B2-04, B1-10 | DB shows ciphertext |
| B8-02 | Bank accounts: add/edit/deactivate/setDefault; account number and IFSC encrypted; IFSC format check only; hidden from Viewers | SVC | B8-01 | One default among active; Viewer denied |
| B8-03 | Company summary: current Admin and role counts | SVC | B3-06 | Counts match |
| B8-04 | Handlers/actions; role matrix rows | API | B8-01..03 | HTTP tests |
| B8-05 | Taint/guard: encrypted and hash columns can never be returned by any `select *`-style repo helper (lint or test scanning repos) | TEST | B8-01 | Test fails if a repo returns `password_hash` |

---

## Phase B9: Backend hardening and the go-live gates

**End = Backend Freeze:** every capability reachable through a tested service and handler, security matrix clean, ready for UI.

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B9-01 | Full security matrix run: every action, handler, file route, cron route, plus raw SQL as `app_user` | TEST | all B-phase matrix rows | 0 unexpected allows in CI |
| B9-02 | Security headers and cookie flags verified in an automated check | TEST | B2-09 | Script passes |
| B9-03 | Load/perf test: 5,000 invoices, 20 concurrent users on list, dashboard, step completion | TEST | B7-12 | p95 under 1 s; report in `docs/` |
| B9-04 | Concurrency tests: two users complete the same step; two Admin transfers; upload during delete | TEST | B5-05, B3-10 | Exactly one winner, no corruption |
| B9-05 | OpenAPI-style contract doc (`docs/api-contract.md`) generated from Zod schemas listing every operation, input, output, errors, roles | OPS | B9-01 | Doc committed; **the UI agents' only input** |
| B9-06 | Privacy pass: field-by-field table of personal data and who sees it (redacted version public) | OPS | B3-06 | Table committed |
| B9-07 | Backup design and restore drill: scheduled `pg_dump` to a second location plus file-store copy; drill restores into blank DB and opens an invoice with its file | OPS | B6-03 | Drill notes (kept private) |
| B9-08 | **Gate: reliable file store.** Owner picks Google Drive or Cloudflare R2; build adapter passing B6-02 suite; production refuses `STORAGE_PROVIDER=local` | SVC | B6-02, B0-01 | Contract suite passes on the real provider |
| B9-09 | Private runbook: add user, reset password, transfer Admin, rotate key, restore, free-tier pause, file store recovery | OPS | B9-07 | Owner signs off |
| B9-10 | Repo mirror/bundle backup; history re-scanned for secrets | OPS | B0-05 | Scan clean |
| B9-11 | **Backend Freeze review:** tick the checklist below; tag `backend-freeze` | OPS | B9-01..10 | Tag pushed |

**Backend Freeze checklist**

- [ ] All B-phase tasks `done` with evidence.
- [ ] Role matrix: 0 unexpected allows (services and raw SQL).
- [ ] Second Admin impossible at the DB; `app_user` cannot alter audit rows.
- [ ] Published flow versions immutable at the DB.
- [ ] No file bytes in Postgres; no public file URL.
- [ ] Amounts round-trip exactly (rupees to paise).
- [ ] Perf: filters use indexes, p95 under 1 s on 5,000 invoices.
- [ ] Purge job idempotent and secret-guarded.
- [ ] No AI code, keys or tables (CI guard green).
- [ ] `docs/api-contract.md` published.

Real data goes in only after B9-07 (restore drill) and B9-08 (reliable store) are done.

---

## UI phases (start only after `backend-freeze`)

UI tasks call services/actions only, render from the contract doc, and add Playwright tests. Shared tasks go first so screens can be built in parallel.

### Phase U1: Shell and shared components

| ID | Task | Needs |
| --- | --- | --- |
| U1-01 | Design tokens, layout, typography, theme (blue = confirmed) | B9-11 |
| U1-02 | App shell: sidebar by role, sign-out, no Agent group | U1-01 |
| U1-03 | Shared components: table, tabs, filter bar, stepper, status chip, empty/loading/error states, confirm dialog | U1-01 |
| U1-04 | Form kit with Zod error display and server error mapping | U1-01 |
| U1-05 | Step form renderer from `fields` (used in builder preview and invoice step) | U1-04 |
| U1-06 | Mobile baseline: breakpoints, card collapse pattern | U1-03 |

### Phase U2: Auth and admin (screens 1, 7)

| ID | Task | Needs |
| --- | --- | --- |
| U2-01 | Sign-in screen with error and reset note | U1-04 |
| U2-02 | Forced password change screen | U2-01 |
| U2-03 | Users table, add user, deactivate, temp password dialog | U1-03 |
| U2-04 | Transfer Admin dialog | U2-03 |
| U2-05 | Role permission matrix and storage/backup settings panel | U2-03 |

### Phase U3: Flows (screens 5, 6)

| ID | Task | Needs |
| --- | --- | --- |
| U3-01 | Flow library with step chips, diff highlight, state, versions | U1-03 |
| U3-02 | Builder: step list with reorder | U3-01 |
| U3-03 | Builder: step settings and fields editor | U1-05 |
| U3-04 | Builder: live preview and publish flow | U3-02, U3-03 |

### Phase U4: Invoices and overview (screens 2, 3, 4)

| ID | Task | Needs |
| --- | --- | --- |
| U4-01 | New-invoice form | U1-04 |
| U4-02 | Invoices list with tabs, filters, URL-held state | U1-03 |
| U4-03 | Invoice detail: stepper, current step form, done steps | U1-05 |
| U4-04 | Documents column and upload control; download links | U4-03 |
| U4-05 | History panel | U4-03 |
| U4-06 | Dashboard with counts, needs attention, by step, activity, health card | U1-03 |
| U4-07 | Reminders bell and list; delete, undo and Recently deleted view | U4-02 |

### Phase U5: Profiles and polish (screens 8, 9)

| ID | Task | Needs |
| --- | --- | --- |
| U5-01 | My profile: details, change password, devices, preferences | U1-04 |
| U5-02 | Company profile: details, bank accounts (Admin edit, others read-only) | U1-04 |
| U5-03 | Phone-width pass on every screen (Playwright at 390 px, no horizontal scroll) | all U |
| U5-04 | End-to-end suite: Admin creates invoice, Builder completes with uploads, Viewer views only | all U |
| U5-05 | Accessibility pass (keyboard, contrast, labels) | all U |

**Release 1 done** when Backend Freeze plus U1 to U5 are done, production uses the reliable file store, the restore drill passed, and the runbook is signed off.

---

## Parallelisation map

- **After B0-02:** OPS (B0-03 to 08, 11 to 13, 15) and SVC (B0-09, B0-10) run side by side.
- **After B1-01:** DB lane builds tables while SEC lane builds B2-01, 02, 03, 04, 09, 11 against the schema stubs.
- **After B2-08:** B3 (identity), B4 (flows) and B6-01 to B6-04 (storage primitives) run as three independent streams.
- **After B4-05 and B6-05:** B5 (invoices) and B8 (company) in parallel; B7 follows B5.
- **UI:** after U1, U2, U3 and U4 are independent streams; U5 last.

## Changes from the original plan

- Security scanning, role-matrix harness, encryption and audit are in B0/B2, not Phase 5.
- Business logic lives in services with their own contract doc (B9-05), so UI and backend can be built by different agents without overlap.
- Concurrency, perf and migration-drift checks added; they were not in the original plan.
- Company profile and bank accounts moved up to the backend phases (B8) so all data capability is frozen before UI.
- Phase 6 (agent) and Phase 7 are unchanged and remain blocked by their gates.

## Open items

- [ ] Confirm roles and that Builder may publish flows (blocks B1-12 onward).
- [ ] Confirm region (B0-12) and go-live file store (B9-08).
- [ ] Confirm the "waiting" threshold default (3 days) and which field types beyond `file`, `text`, `confirm` are wanted.
- [ ] Decide where private notes live (B0-16).
