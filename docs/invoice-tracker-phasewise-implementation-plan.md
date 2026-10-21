# Invoice Tracker: Phasewise Implementation Plan

Draft dated 2026-10-11. Companion to `invoice-tracker-wireframes.md`, `invoice-tracker-database-and-security-architecture.md` and `invoice-tracker-agentic-ui.md`. Editable doc version: https://claude.ai/code/artifact/a062b0cf-0ef6-4a4d-8453-28d70c1f9993

## How agents use this plan

This plan splits the Invoice Tracker into 8 phases (0 to 7), each with a verifiable start state, numbered work items and an end state. An agent may begin a phase only when every start-state check passes, and may call it done only when every end-state check passes with evidence.

**Delivery order (decided 11 Oct 2026).**

- **Release 1 is Phases 0 to 5.** It builds wireframe screens 1 to 9 only: sign in, dashboard, invoices list, invoice detail, flow library, flow builder, team and roles, my profile, company profile. It has no agent, no model calls, no AI vendor keys and no AI tables.
- **Release 2 is Phase 6.** It builds the agentic screens 10 to 16 on top of a live Release 1: Agent home, Ask the agent, Invoice with agent, Review queue, Agent activity, Flow builder with agent, Agent settings.
- **Phase 7 is optional** and is not scheduled.
- The wireframe sidebar shows an Agent group (Agent home, Review queue, Agent activity, Agent settings). **Do not build or show it in Release 1.** Screens 1 to 9 must work completely with no agent.

**Source of truth.** The plan merges the four project docs: idea/problem/research/solution, wireframes, database and security architecture, and the agentic UI proposal (Phase 6 only). Where they conflict, the database doc wins (its note says it supersedes the others on Excel import and on file storage).

**Resolved decisions used throughout**

- Delivery order: wireframe screens 1 to 9 first (Release 1, Phases 0 to 5), agentic screens 10 to 16 later as Phase 6 (Release 2).
- Stack: Next.js (App Router), PostgreSQL on Neon, Vercel Hobby for now.
- File storage: during the build, files go to a local folder behind a storage adapter (decided 11 Oct 2026, replacing the earlier Google Drive plan, because the Drive OAuth setup needs more than is ready). A local folder is for test data only. **Before the app is deployed anywhere that accepts uploads, the team must first switch to a reliable store (Google Drive or Cloudflare R2, owner to choose) and only then proceed.** See P5-15.
- Roles: `admin` (exactly one, enforced by a partial unique index), `builder`, `viewer`.
- Sign-in: username + password (argon2id), own session table, long random tokens stored hashed. No third-party auth service.
- Excel import: out of scope. Wireframe screen 3's "Import from Excel" button is removed.
- Email: manual. The user sends it and records it on the step. The agent in Phase 6 may draft email text but never sends it.
- Delete: soft delete with a 30-day undo window, then a scheduled purge of the row and its stored file. The audit log is never purged. Only the Admin may delete; no accountant sign-off is needed.
- Backups: none for now (per the database doc), gated before real data. See Phase 5. Company bank details are stored, field-encrypted, and a company may have several bank accounts.
- Bank IFSC validation: format check only for now (4 letters, `0`, 6 letters or digits). No online IFSC lookup API.

**Planning assumptions (not in the source docs, change if you disagree)**

- TypeScript throughout; Drizzle ORM with hand-written SQL migrations for what an ORM cannot express (RLS, triggers, partial indexes, citext).
- Zod for validation; Vitest for unit and database tests; Playwright for end-to-end tests; a plain Postgres test database (a Neon branch or local Docker).
- Login rate limiting is stored in Postgres, since there is no Redis.
- Scheduled jobs (purge, reminders) run as Vercel Cron hitting a secret-protected route.
- Phases 0 to 4 are built and run locally. A hosted preview on Vercel cannot keep uploaded files (serverless hosting does not persist local disk between requests or deploys), so previews are used for pages that do not need uploads until P5-15 is done.
- Release 1 should leave the seams that make Phase 6 an addition, without building any AI: the storage adapter, a single audit writer, server actions that take the acting user and re-check roles, and `documents` rows that carry `sha256`, `mime_type` and `scan_status`.

**Rules for every agent**

1. Work items have IDs like `P3-04`. Reference them in commits and in the status log.
2. One work item = one branch/PR with its tests. Do not start items whose `Needs` are not done.
3. Re-check roles in every server action and route handler. Hiding a button is never the control.
4. Never put file bytes in the database, never expose a public file URL, never store a password or secret in the repo.
5. A step's "Evidence" is a command output, test name, query result or screenshot path pasted in the status log. No evidence, not done.
6. Stop and ask the owner when a work item hits an open decision (Phase 0 list, and P6-01 for Phase 6). Do not guess.
7. Do not deploy anywhere that accepts uploads, and do not load real data, until P5-15 (reliable file storage) is done. The local adapter must refuse to start in production.
8. Release 1 (Phases 0 to 5) contains no AI features: no model calls, no AI keys, no agent tables, no agent routes, no Agent navigation. Phase 6 work does not start before its gates are met.

**Status protocol.** Keep one `STATUS.md` in the repo root with one row per work item: ID, state (todo, doing, blocked, done), PR link, evidence. A phase is done only when all its rows are done and its end-state checklist is ticked.

## Phase overview

The build runs strictly in order. Phases 0 to 5 make Release 1. Phase 6 makes Release 2 and starts only after its gates are met. Phase 7 is optional. Each phase ends in something a person can open and check.

| Phase | Name | Needs | Start state | End state |
| --- | --- | --- | --- | --- |
| 0 | Decisions and setup | none | Planning docs exist; no repo, no accounts | Repo, Neon DB, local file folder and Vercel project exist; owner decisions logged; `STATUS.md` created |
| 1 | Foundation | 0 | Empty repo with CI and env config | Users can sign in, roles are enforced in app and database, Admin can add users; core tables migrated |
| 2 | Flow engine | 1 | Signed-in app with roles and `users` only | Builders can draft, publish and version flows (Standard and Courier seeded); published versions are immutable |
| 3 | Invoices and documents | 2 | Published flows exist; no invoices | Users create invoices, complete steps in order, upload and download files in the local folder with permission checks |
| 4 | Overview | 3 | Invoices run end to end but are only reachable by direct URL | Dashboard, filtered list, history, reminders, soft delete and undo with 30-day purge job |
| 5 | Profiles, hardening, go-live | 4 | Feature-complete app on test data and local file storage | Profiles, field encryption, RLS verified, security tests pass, reliable file storage in place, backup gate cleared, ready for real data. **Release 1 live** |
| 6 | Agentic layer (screens 10 to 16) | 5, Phase 6 gates | Release 1 live with real users; owner has decided provider, cap and privacy and given the go-ahead | Agent reads documents, answers questions and drafts flows and reminders; every suggestion is reviewed by a person; traced, capped and pausable. **Release 2 live** |
| 7 | Later | 5, real usage | Live app | Optional: two-step sign-in, email automation, virus scanning, search over documents, hosting/storage move |

**Critical path.** Hosting and the go-live file-store choice (Google Drive or Cloudflare R2) block Phase 5, not Phases 0 to 4. Everything else can proceed with placeholders, so Phases 1 and 2 can start while those decisions are pending. The Phase 6 gates block Phase 6 only.

## Phase 0: Decisions, accounts and project setup

**Goal:** remove every blocker that is a person's decision or an account, so agents can build without guessing.

**Start state**

- [ ] The project docs are present and read.
- [ ] No code repository, database, file folder or hosting project exists.

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P0-01 | Owner answers the open decisions below and the answers are copied into `DECISIONS.md` | none | File committed with a date and answer per decision |
| P0-02 | Create the Git repo with Next.js (App Router, TypeScript), lint, format, Vitest, Playwright, and a CI workflow that runs lint, typecheck and tests | none | CI green on an empty-feature commit |
| P0-03 | Create the Neon project (region nearest the team); record the pooled and direct connection strings in Vercel and local env only | P0-01 | `select 1` succeeds from the app; no secret in the repo |
| P0-04 | Set up local file storage: a folder outside the web root and outside `public/` (configured by `FILE_STORAGE_DIR`, with `STORAGE_PROVIDER=local`), listed in `.gitignore`, created on first run. Google Drive or R2 setup is deferred to P5-15 | P0-01 | A scripted test writes, reads and deletes a file in that folder; `git status` shows the folder is ignored |
| P0-05 | Create the Vercel project from the repo; set the env vars (`DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `STORAGE_PROVIDER`, `CRON_SECRET`; provider keys are added in P5-15) | P0-02, P0-03 | Preview deploy loads a health page |
| P0-06 | Write `.env.example`, a README (run, test, migrate, deploy) and `STATUS.md` with every work item in this plan as a `todo` row | P0-02 | Fresh clone runs with only the README |
| P0-07 | Store the encryption key in two places outside the database and note the rotation steps in `DECISIONS.md` | P0-05 | Both locations named (no key values) |

**Open decisions the owner must answer** (from the project docs)

- [ ] Choose the go-live file store: Google Drive or Cloudflare R2, and whose account holds it. Does not block Phases 0 to 4; blocks P5-15 and any deployment that accepts uploads.
- [x] Resolved: the app stores company bank details, and a company can have more than one bank account (see P5-01 and P5-03).
- [x] Resolved: only the Admin may delete, and no accountant sign-off is needed.
- [ ] Confirm the three roles, the single-Admin rule, and that Builder may build and publish flows. Blocks P1.
- [ ] Confirm the database and hosting region. Blocks P0-03.
- [x] Resolved: stay on Vercel Hobby for now. Its terms limit it to personal, non-commercial use, so this is an accepted risk to revisit if limits or terms become a problem.
- [x] Resolved: build with a local file folder; switch to a reliable store before any deployment (P5-15).
- [x] Resolved: build wireframe screens 1 to 9 first (Release 1, Phases 0 to 5); build the agentic screens 10 to 16 later as Phase 6 (Release 2). The agent decisions (provider, cap, privacy) are asked in P6-01, not now.

**End state (all must be true)**

- [ ] `main` has a green CI run and a working preview deploy.
- [ ] The app can reach Neon and the local file folder with secrets only in environment settings.
- [ ] `DECISIONS.md` has an answer, or a dated default, for every open decision above.
- [ ] `STATUS.md` lists every work item in this plan.

## Phase 1: Foundation (sign-in, roles, base schema)

**Goal:** a private app where only known users get in, and each role can do only what it should, enforced in the app and in the database. Covers wireframe screens 1 and 7 (users part).

**Start state**

- [ ] Phase 0 end state is met.
- [ ] Database is empty; the app has no routes beyond a health page.

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P1-01 | Migration 001: extensions (`citext`, `pgcrypto`/`gen_random_uuid`), `user_role` enum, `users` (with `one_admin` partial unique index), `sessions`, `audit_log` (append-only) | none | Migration applies to a blank DB; inserting a second admin fails |
| P1-02 | Database roles: an owner role for migrations and a limited `app_user` role for the app; revoke `UPDATE`/`DELETE` on `audit_log` from `app_user` | P1-01 | `app_user` cannot update or delete an audit row (test) |
| P1-03 | Password module: argon2id hash and verify, minimum length rule, constant-time compare | P1-01 | Unit tests: hash differs per call, wrong password fails |
| P1-04 | Session module: random token, store only its hash, expiry, `last_seen_at`, revoke one or all sessions, secure cookie (HttpOnly, SameSite, Secure) | P1-01 | Tests for expiry, revocation and tampered tokens |
| P1-05 | Login rate limiting and lockout stored in Postgres (per username and per IP) | P1-03 | Test: Nth failed try is blocked, then allowed after the window |
| P1-06 | Sign-in screen `(auth)/login` with error state and the "ask your Admin to reset" note; generic error text that does not reveal whether the username exists | P1-03, P1-04, P1-05 | Playwright: good login, bad login, locked login |
| P1-07 | `middleware.ts`: session check first, then role per route group `(auth)` and `(app)`; unauthenticated users go to login | P1-04 | Playwright: protected URL redirects when signed out |
| P1-08 | Request context: set `SET LOCAL app.user_id` and role inside a transaction per request; helper `withUser(tx)` used by every query | P1-02, P1-07 | Test: a query sees the acting user id |
| P1-09 | Row-level security on `users` (Viewer and Builder read only, own-row edits for profile fields, only Admin writes role and active state) | P1-08 | DB tests per role: allowed and denied cases |
| P1-10 | Bootstrap script that creates the single Admin from env input on first run and refuses to run twice | P1-01, P1-03 | Second run exits with an error; Admin can sign in |
| P1-11 | Admin users screen `(app)/admin/users`: list, add user (Builder or Viewer only), deactivate, issue one-time temporary password, forced change at first login | P1-09, P1-10 | Playwright as Admin; Builder gets a 403 on the route |
| P1-12 | Transfer Admin role server action: one transaction, old Admin becomes Builder, the one-admin index stays true, audit row written | P1-11 | Test: exactly one admin before and after; Admin cannot be deactivated |
| P1-13 | Audit writer: `audit(actor, action, entity, entity_id, before, after)` called for sign-in, failed sign-in, user creation, role change, deactivation, password reset. Keep it as the single place that writes audit rows | P1-02 | Each action produces one audit row (test) |
| P1-14 | App shell: navigation by role (controls a role cannot use are hidden or read-only with an explanation), sign-out, session list basics. No Agent group in the sidebar until Phase 6 | P1-07 | Screenshot of the shell as each of the 3 roles; no Agent items shown |

**End state (all must be true)**

- [ ] A user can sign in, sign out, and is locked out after repeated failures.
- [ ] A signed-out request to any `(app)` route is redirected; a Viewer or Builder request to `admin/users` is refused on the server.
- [ ] The database itself rejects a second Admin, and `app_user` cannot modify audit rows.
- [ ] Admin can add, deactivate and reset users, and transfer the Admin role.
- [ ] Passwords and session tokens are never stored in plain text (checked by querying the tables).
- [ ] CI runs the database tests and Playwright login tests and they pass.

## Phase 2: Flow engine (templates, versions, builder)

**Goal:** the product's core. A Builder defines a flow once, publishes it, and edits create a new version without disturbing anything already running. Covers wireframe screens 5 and 6.

**Start state**

- [ ] Phase 1 end state is met.
- [ ] Tables `flow_templates`, `flow_versions`, `flow_steps` do not exist; no flows exist.

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P2-01 | Migration 002: `flow_templates` (name, status draft/published/archived), `flow_versions` (template_id, version_no, published_at), `flow_steps` (version_id, position, name, instructions, `allowed_role`, `fields` JSONB) with unique (version_id, position) | none | Migration applies cleanly |
| P2-02 | Zod schema for the `fields` list: types `file`, `text`, `confirm` (plus `date` and `number` if the owner wants them), keys unique within a step, `required` flag, JSON-object check constraint | P2-01 | Unit tests for valid and invalid field lists |
| P2-03 | Trigger that blocks `UPDATE` and `DELETE` on steps of a published version | P2-01 | DB test: editing a published step raises an error |
| P2-04 | RLS for flow tables: all roles read; Admin and Builder write; Viewer denied | P2-01, P1-08 | DB tests per role |
| P2-05 | Flow actions (server actions, role re-checked): create draft, add, edit, reorder and remove steps, duplicate a flow, archive | P2-02, P2-04 | Tests per action and role |
| P2-06 | Publish action: freeze the draft as version N+1 of the template in one transaction; later edits start a new draft version | P2-03, P2-05 | Test: publish twice gives versions 1 and 2; version 1 is unchanged |
| P2-07 | Flow library `(app)/flows`: flows as step chips, the step that differs between flows highlighted, draft or published state, version number, active invoice count (zero until Phase 3) | P2-05 | Screenshot against wireframe 5 |
| P2-08 | Flow builder `(app)/flows/[id]/edit`: step list with reorder, step settings (name, instructions, who can complete, fields editor), live preview of the step form, publish button | P2-05, P2-06 | Playwright: build and publish a 3-step flow |
| P2-09 | Shared step form renderer that turns a `fields` list into a form (used by the builder preview now and by invoice steps in Phase 3) | P2-02 | Component tests for each field type |
| P2-10 | Seed script for two flows: **Standard delivery** (invoice raised, upload invoice, delivery challan uploaded, email sent, payment verified, completed) and **Courier delivery** (same, with step 4 as courier arranged and email sent, with courier name, "I have sent the email" confirmation, optional email proof) | P2-06 | Both flows published; the library highlights step 4 only |
| P2-11 | Audit rows for flow create, edit, publish, archive | P1-13 | One audit row per action (test) |

**End state (all must be true)**

- [ ] A Builder can create, edit and publish a flow with no developer involved.
- [ ] Editing a published flow creates a new version; version 1 is byte-for-byte unchanged (test).
- [ ] The database blocks edits to published steps even if the app is bypassed.
- [ ] A Viewer can see flows but cannot change them, in the interface and on the server.
- [ ] Standard and Courier flows are seeded and differ only at step 4.
- [ ] Step forms render from `fields` and validate required fields.

## Phase 3: Invoices, step completion and documents

**Goal:** a team member can start an invoice on a flow, complete its steps in order as work happens, and attach documents that stay private in the file store (a local folder for now). Covers wireframe screens 3 (basic list) and 4, and the new-invoice form that the wireframes did not design.

**Start state**

- [ ] Phase 2 end state is met; Standard and Courier flows are published.
- [ ] Phase 0 local file folder works (P0-04).
- [ ] No `invoices`, `invoice_steps` or `documents` tables.

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P3-01 | Migration 003: `invoices` (as in the database doc: `amount_minor` bigint in paise, `flow_version_id`, `current_step_id`, `status`, `due_date`, `owner_id`, `extra` JSONB, `deleted_at`) with the `status, due_date` partial index and indexes for owner, flow and step; `invoice_steps` with unique (`invoice_id`, `flow_step_id`); `documents` with `storage_provider`, `object_key`, `original_filename`, `sha256`, `mime_type`, `size_bytes`, `scan_status`, `uploaded_by` | none | Migration applies; unique and check constraints reject bad rows |
| P3-02 | RLS: all roles read invoices, steps and documents; Admin and Builder write; Viewer denied; `step.allowed_role` honoured | P3-01 | DB tests per role |
| P3-03 | New-invoice form: invoice number (unique), party name, amount (entered in rupees, stored in paise), issue and due dates, owner, flow picker; Admin and Builder only; creates `invoice_steps` for the chosen flow version | P3-01 | Playwright: create an invoice on Courier flow |
| P3-04 | Step completion server action: checks session, role, `allowed_role`, order (previous step done), required fields from `flow_steps.fields`, writes `data` JSON, status moves forward only, updates `current_step_id` and invoice `status`; trigger as backstop for order and for double completion | P3-02, P2-09 | Tests: out-of-order, repeat, missing required field and wrong role are all refused |
| P3-05 | Storage adapter behind an interface (`put`, `get stream`, `delete`), with the local-folder implementation selected by `STORAGE_PROVIDER=local`; keys are document IDs, never user filenames; path-traversal protection; a shared contract test suite that any later adapter (Drive or R2) must also pass; the local adapter refuses to start when `NODE_ENV=production` | P0-04 | Contract tests pass against a temp folder; a test shows startup fails in production mode with the local provider |
| P3-06 | Upload action: check session and role; allow PDF, PNG, JPG (DOCX and XLSX optional per owner); size cap 10 MB; compute `sha256`; store file named by document ID; insert the `documents` row; if the insert fails, delete the orphan file; link the document ID into the step `data` | P3-04, P3-05 | Tests: wrong type, oversize, duplicate hash warning, orphan cleanup |
| P3-07 | Download route `api/files/[id]`: check session, role and invoice access, write a view row to `audit_log`, stream the file (or give a link valid for 60 seconds once a remote store is in use); no public URL ever and the storage folder is never served statically | P3-05 | Test: signed-out and wrong-role requests get 401 or 403; the storage path is not reachable by URL |
| P3-08 | Invoice detail `(app)/invoices/[id]`: stepper, done steps show who, when and files, current step is an inline form built by the shared renderer, side column with details, documents and history | P3-04, P3-06, P3-07 | Screenshot against wireframe 4 |
| P3-09 | Manual-email step behaviour: confirmation "I have sent the email" plus optional proof upload recorded on the step | P3-06 | Courier flow cannot complete step 4 without the confirmation |
| P3-10 | Basic invoices list `(app)/invoices` with the current step and owner per row and a link to detail (filters and tabs come in Phase 4) | P3-03 | Screenshot of list as each role |
| P3-11 | Audit rows for invoice create, step completion, upload and download | P1-13 | One row per action (test) |
| P3-12 | End-to-end script: Admin creates an invoice on Standard, a Builder completes all steps with uploads, a Viewer views and downloads but cannot act | P3-08, P3-10 | Playwright run green in CI |

**End state (all must be true)**

- [ ] An invoice can be created on either flow and walked to Completed, step by step, in order.
- [ ] An invoice keeps the flow version it started on, even after that flow is edited and republished (test).
- [ ] Every uploaded file is in the private storage folder and referenced in `documents`; no file bytes are in Postgres (query check).
- [ ] A file cannot be fetched without a valid session and role; no public file URL exists.
- [ ] Amounts round-trip exactly between rupees on screen and paise in the database.
- [ ] Viewer can read and download but every write is refused on the server.
- [ ] Files in the local folder are treated as test data only.

## Phase 4: Overview, history, reminders, delete and undo

**Goal:** one screen answers "where is this invoice?" and "what needs attention?", and the delete lifecycle works safely. Covers wireframe screen 2 and the full screen 3.

**Start state**

- [ ] Phase 3 end state is met.
- [ ] Invoices exist (test data) but there is no dashboard, no filtering and no delete.
- [ ] Excel import is not built and stays out of scope; the list has no import button.

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P4-01 | Invoices list tabs (All, Mine, Waiting, Overdue, Completed) and filters (flow, step, owner, date range), sortable, with progress and current step per row; URL holds the filter state | none | Playwright for each tab and filter; `EXPLAIN` shows the indexes are used |
| P4-02 | Definitions in one place: Waiting = current step open more than 3 days (configurable); Overdue = past `due_date` and not completed | P4-01 | Unit tests on boundary days |
| P4-03 | Dashboard `(app)/dashboard`: counts of open, waiting, overdue and completed; needs-attention list; invoices by step; recent activity from `audit_log`; short caching (30 to 60 seconds) for counts | P4-02 | Screenshot against wireframe 2; counts match SQL |
| P4-04 | Storage and backup health card on the dashboard: file store reachable, database reachable, storage used, and the text "backups: none" until Phase 5 clears it | P4-03 | Card turns red when a dependency check fails (test with an unreachable storage folder) |
| P4-05 | Invoice history panel on detail: who did what and when from `audit_log`, newest first | P3-11 | Panel matches audit rows for a test invoice |
| P4-06 | In-app reminders (rule based, no AI): step waiting more than 3 days and payment due soon, shown as a bell list and dashboard section; per-user preferences from wireframe 8 (email reminders shown as "Coming later") | P4-02 | Test: reminder appears and clears after completion |
| P4-07 | Soft delete action: Admin only (Builders and Viewers cannot delete); sets `deleted_at`, hides the invoice and its documents, writes an audit row; confirmation dialog states the 30-day window | P0-01 | Deleted invoice disappears from lists and returns 404 on detail and file routes |
| P4-08 | Undo action: clears `deleted_at` within 30 days, restores visibility, writes an audit row; "Recently deleted" view lists items with days left | P4-07 | Test: undo on day 29 works, on day 31 refused |
| P4-09 | Purge job (Vercel Cron to a route guarded by `CRON_SECRET`, or a script run locally while the local adapter is in use): for rows with `deleted_at` older than 30 days, delete the stored files through the adapter first then the rows in one pass; audit the purge; the 30 is one setting; audit log never purged | P4-07, P3-05 | Test with a time-shifted row: files and rows gone, audit rows remain; dry-run mode logs without deleting |
| P4-10 | Empty, loading and error states for list, dashboard and detail (not designed in wireframes) | P4-01, P4-03 | Screenshot of each state |
| P4-11 | Mobile layouts: lists collapse to cards, stepper stacks, forms single column at phone width | P4-01 | Playwright at 390px wide: no horizontal scroll on every `(app)` screen |

**End state (all must be true)**

- [ ] The dashboard counts equal the counts from direct SQL on the same data.
- [ ] Every list filter returns correct rows and uses an index on 5,000 seeded invoices with a response under 1 second (measured).
- [ ] Delete hides immediately, undo restores within 30 days, and the purge job removes both row and stored file after 30 days.
- [ ] The purge job is idempotent and refuses to run without the secret.
- [ ] History on an invoice shows every step change, upload and download.
- [ ] Every screen is usable at phone width.

## Phase 5: Profiles, hardening and go-live gates

**Goal:** finish the remaining screens, prove the security design works, move files to a reliable store, and clear the backups gate, which the docs say must be settled before real business data goes in. Covers wireframe screens 8, 9 and the remaining part of 7. Finishing this phase is Release 1.

**Start state**

- [ ] Phase 4 end state is met.
- [ ] Only test data is in the system, and its files are in the local folder.
- [ ] `company_profile` does not exist; no field encryption is in place.

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P5-01 | Migration 004: `company_profile` (single row: legal name, GSTIN plain, PAN encrypted, invoice defaults) and `company_bank_accounts` (one row per account: label, bank name, account holder, branch, account number and IFSC encrypted, is_default, is_active; exactly one default among active accounts) | none | Migration applies; a second company profile row is rejected; a second default bank account is rejected |
| P5-02 | Field encryption module: AES-256-GCM with the key from env, unique nonce per value, key-rotation script, decrypt only in server code | P0-07 | Tests: round trip, tampered value fails, rotation re-encrypts all rows |
| P5-03 | Company profile `(app)/company`: Admin edits, others read-only; shows current Admin and role counts; bank accounts section where the Admin can add, edit, deactivate and set the default among several accounts; bank details hidden from Viewers | P5-01, P5-02 | Screenshot as each role; DB shows ciphertext only |
| P5-04 | My profile `(app)/profile` (own data only): photo, personal details, read-only username, change password (revokes other sessions), signed-in devices with revoke, preferences; "two-step sign-in" shown as Coming later | P1-04 | Playwright: change password, revoke a device |
| P5-05 | Team, roles and storage tab: permission matrix, storage and backup settings, file store provider and account name | P1-11 | Matches wireframe 7 |
| P5-06 | Security test suite: for each route, server action and file route, call it signed out and as each role and assert the expected result; includes direct SQL as `app_user` to prove RLS blocks writes the app would not make | P5-04 | Matrix report in CI, 0 unexpected allows |
| P5-07 | Security headers (CSP, HSTS, frame, referrer, content type), cookie flags, CSRF protection for actions, upload content sniffing | P5-06 | Header check script passes |
| P5-08 | Dependency and secret scanning in CI; no secrets in the repo history | P0-02 | CI scan clean |
| P5-09 | **Gate: backups.** Decide and implement a way to restore data and files before real data (for example a scheduled `pg_dump` to a second location plus a copy of the file store), and run one restore drill | owner decision, P5-15 | Restore drill notes: restored a dump into a blank DB and opened an invoice with its file |
| P5-10 | **Hosting decision.** Owner has chosen to stay on Vercel Hobby for now; record the choice and the region, and revisit if usage limits are hit or the terms are enforced | owner decision | `DECISIONS.md` entry and a working production URL |
| P5-11 | **Retention decision.** Owner has decided no accountant sign-off is needed; record that only the Admin can delete and that permanent purge happens 30 days after delete | owner decision | Dated answer in `DECISIONS.md` |
| P5-12 | Privacy pass for personal data (names, phones, emails): collect only what screens need; visible to Admin and the owner only; general note that this is not legal advice | P5-04 | Field-by-field table committed in `docs/` |
| P5-13 | Go-live runbook: add users, reset a password, transfer Admin, rotate the encryption key, restore from backup, what to do when a free tier pauses, how the file store is accessed and recovered | P5-09 | Runbook reviewed by the owner |
| P5-14 | Clean production data: remove test invoices and users, create the real Admin, seed the real flows | P5-10, P5-15 | Production DB contains only real data |
| P5-15 | **Gate: reliable file storage (do this before any deployment that accepts uploads, then proceed).** Owner picks Google Drive or Cloudflare R2. Build that adapter behind the P3-05 interface and pass the same contract tests. For Drive: a private folder, OAuth client, consent screen set to In production (a refresh token from Testing mode expires after about 7 days; verify against Google's current docs), refresh token stored as a secret, and a dedicated account that does not depend on one person. For R2: a private bucket with keys in env. Copy any test files that must be kept, set `STORAGE_PROVIDER` to the new provider in production, and add the provider keys to the Vercel env | owner decision, P3-05 | Contract tests pass against the real provider; a scripted upload, download and delete still works after 8 days (Drive); production start-up with `STORAGE_PROVIDER=local` fails; upload through the deployed app lands in the reliable store |

**End state (all must be true)**

- [ ] Both profile screens work and respect roles; bank details and PAN are ciphertext at rest.
- [ ] The security matrix has no unexpected allows, and RLS blocks every direct write that role should not make.
- [ ] Files are stored in the chosen reliable store in production, and the local adapter is refused there.
- [ ] A restore drill has succeeded, and the hosting and retention decisions are recorded in DECISIONS.md. Without the restore drill, real data must not go in.
- [ ] A runbook exists and the owner has signed it off.
- [ ] Production is live with real users and no test data.
- [ ] Release 1 contains none of the Phase 6 parts: no Agent navigation, no agent routes, no agent tables, no AI keys (checked by searching the repo and the database).

## Phase 6: Agentic layer (Release 2, wireframe screens 10 to 16)

**Goal:** add an agent that reads documents, answers questions, and drafts text, flows and reminders, while people keep every decision. Covers wireframe screens 10 to 16: Agent home, Ask the agent, Invoice with agent, Review queue, Agent activity, Flow builder with agent, Agent settings. Design rules are in `invoice-tracker-agentic-ui.md`.

**Gates: Phase 6 does not start until all are true**

- [ ] Release 1 (Phases 0 to 5) is live with real users and its definition of done is met.
- [ ] The team has used Release 1 for a period the owner sets (suggested: 4 weeks, a planning assumption), and the owner can name the 2 or 3 tasks that cost the most time, so the agent starts with real needs.
- [ ] The P6-01 decisions are answered: model provider, monthly cap, privacy acceptance, first capabilities.
- [ ] The owner has given an explicit go-ahead, recorded in `DECISIONS.md`.

**Start state**

- [ ] All four gates above are ticked.
- [ ] No agent tables, routes or settings exist.

**Sub-phases** (run in order; each ends with something to check)

| Sub-phase | Work items | Result |
| --- | --- | --- |
| 6A Foundations | P6-01 to P6-06 | Decisions logged, tables, permissions, model gateway, tool registry and the Admin settings screen, with nothing user-facing yet |
| 6B Read and review | P6-07 to P6-10 | Documents are read, suggestions wait in the Review queue, and the invoice screen shows them beside the document |
| 6C Ask, home and oversight | P6-11 to P6-12 | Command bar, Agent home and Agent activity with run traces |
| 6D Drafting | P6-13 to P6-15 | Reminders, flow drafts and review notifications |
| 6E Prove and roll out | P6-16 to P6-18 | Accuracy measured, security tested, gradual rollout |

| ID | Work item | Needs | Evidence |
| --- | --- | --- | --- |
| P6-01 | Owner decisions recorded in `DECISIONS.md`: model provider (a free tier, a paid API with a hard cap, or a small local model), monthly cap, whether sending documents to that provider is acceptable for business invoices, and the first capabilities to enable (suggested: read challans and answer questions) | none | Dated answers; the provider's data-use terms read and summarised in two lines |
| P6-02 | Migration 005: `agent_settings` (single row: enabled, paused, monthly cap, trace retention days), `agent_capabilities` (key, level off/suggest/ask/auto, locked flag), `agent_runs`, `agent_run_steps`, `agent_proposals` (status pending/accepted/edited/rejected/applied/reverted, evidence JSONB, confidence), `document_extractions`, `ai_jobs`; add `actor_type` (person or agent) and `on_behalf_of` to `audit_log` | P6-01 | Migration applies; a locked capability cannot be set above its allowed level (check constraint test) |
| P6-03 | RLS and grants: settings and capabilities writable by Admin only; proposals and runs readable only by people who can see the invoice; `app_user` cannot update or delete run steps or audit rows | P6-02, P1-08 | DB tests per role |
| P6-04 | Model gateway behind an interface, like the storage adapter: provider adapter, timeouts, retries, budget check before every call, usage logged per run, honours the pause switch; a fake provider for tests; a redaction filter that removes locked data (password hashes, session tokens, bank details, PAN, keys) before anything is sent | P6-02 | Contract tests with the fake provider; a payload containing bank fields is stripped (test); calls are refused when the cap is reached or the agent is paused |
| P6-05 | Agent tool registry: each tool wraps an existing permission-checked server action and runs with the asking person's session and role; only allow-listed tools exist; locked actions (send email, publish flow, complete step, delete or purge, users, roles, company profile, bank details) are absent from the registry | P6-04 | For each role, every tool call is refused when that role could not do it directly (test); a registry test lists no locked tool |
| P6-06 | Agent settings screen `(app)/agent/settings` (screen 16, Admin only): master switch, pause-all button, level per capability with locked rows, what the agent may see, provider, monthly cap and usage, trace retention | P6-03, P6-04 | Playwright: Admin changes levels, Builder gets 403; locked rows cannot be changed; pause stops a running job |
| P6-07 | Proposal engine: create, list, approve, edit, reject, apply and revert; applying runs the normal server action in one transaction and writes `audit_log` with actor type agent, on behalf of the asker, approved by the reviewer; extracted values stay in `document_extractions` until applied | P6-05 | Tests: apply writes through the normal action; confirmed data is untouched before approval; revert restores the old value |
| P6-08 | Review queue `(app)/agent/review` (screen 13) with the sidebar count: tabs by type, field-by-field comparison, per-field apply, Reject all, Edit in step, Apply selected, keyboard shortcuts | P6-07 | Playwright: approve 2 of 3 fields; Viewer cannot approve |
| P6-09 | Document reading job: on upload, queue an `ai_jobs` row, read the file through the gateway, store fields, confidence and evidence boxes in `document_extractions`, create a proposal; low-confidence fields left blank; mismatches against invoice data flagged, not corrected; document text treated as data, never as instructions | P6-07, P3-06 | Tests on sample challans: fields extracted, blank on low confidence, mismatch flagged; a document containing "ignore your rules" text causes no tool call |
| P6-10 | Invoice with agent (screen 12, on `(app)/invoices/[id]`): document viewer with numbered evidence boxes, suggested values and confidence in the step form (extends the renderer from P2-09), mismatch warning, drafted email text with Copy only, scoped agent rail that states what it can and cannot see | P6-09, P3-08 | Playwright: accept 2 high-confidence fields, complete the step by hand; no send-email control exists |
| P6-11 | Ask the agent (screen 11, Ctrl K) and Agent home (screen 10, `(app)/agent`): answers built from read-only queries with source links, proposed actions that need approval, daily briefing from a scheduled job and cached, trust-check figures from proposal outcomes | P6-05, P6-07 | Every answer carries sources (test); numbers match direct SQL; the briefing job is idempotent |
| P6-12 | Agent activity (screen 14, `(app)/agent/activity`): run list, step trace, what was shared with the model, usage, audit entry, revert, export of the run log, retention purge of traces | P6-07 | Trace for a test run matches `agent_run_steps` and audit rows; the purge removes traces older than the setting but never audit rows |
| P6-13 | Reminders by the agent: draft reminder text and create in-app reminders at the level set in settings (auto-apply with undo suggested) | P6-07, P4-06 | Reminder created and undone from Agent activity; no email sent |
| P6-14 | Flow drafting (screen 15, on `(app)/flows/[id]/edit`): describe a process, get a draft flow compared with an existing version (new, changed, unchanged), one clarifying question at a time, saved as a draft only; publishing stays with a person | P6-05, P2-06 | The agent can create a draft but the publish action is refused for agent calls (test); the draft shows as a comparison against the existing version |
| P6-15 | In-app notification that a run needs review | P6-08 | Notification appears and clears after review |
| P6-16 | Evaluation set: at least 30 redacted real challans and invoices; measure field accuracy and set the High, Medium and Low thresholds from the data; results in `docs/agent-eval.md` | P6-09 | Report with per-field accuracy; thresholds chosen from data |
| P6-17 | Security tests for the agent: the asking person's role is the ceiling; prompt injection through documents or invoice text cannot trigger tools; locked data never reaches the gateway; the cap pauses the agent while people keep working; direct SQL as `app_user` cannot alter traces | P6-05, P6-09 | Agent rows added to the security matrix in CI, 0 unexpected allows |
| P6-18 | Gradual rollout and runbook update: Admin only for 1 to 2 weeks, then Builders (document reading and Ask), Viewers get Ask read-only; runbook gains pause, cap, provider outage and "the agent got it wrong" | P6-16, P6-17 | Rollout log; runbook reviewed by the owner |

**End state (all must be true)**

- [ ] Screens 10 to 16 work and respect roles; only the Admin can open Agent settings.
- [ ] Nothing the agent produces changes confirmed data without a person approving it. The only exception is a capability the Admin set to auto-apply (such as reminders), and it is undoable.
- [ ] Locked actions do not exist for the agent (registry test), and locked data never reaches the model provider (gateway test).
- [ ] The pause switch and the spending cap both work (tests).
- [ ] Every run has a trace, and audit rows show actor type agent, on behalf of whom, and who approved.
- [ ] The evaluation report exists and the confidence thresholds come from it.
- [ ] With the agent switched off or paused, every Release 1 screen (1 to 9) works exactly as before (test).

## Phase 7 (later): optional extensions

Nothing here is built until the team has used the live app and a need is proven. Each item is its own mini-phase with the same start and end state discipline; an agent must get the owner's go-ahead before starting any of them.

| Item | Start state | End state | Notes |
| --- | --- | --- | --- |
| Two-step sign-in | Password-only sign-in live | Second factor required for Admin and Builder; recovery path documented | Shown as "Coming later" in wireframes |
| Email reminders and automated emails | In-app reminders live | Reminder emails sent on the same rules; courier-step email sent from the app and proof stored | Needs a free email sender; check its limits first. The Phase 6 agent still only drafts email text |
| Search over documents | Phase 6 live and Ask needs more than structured queries | `document_chunks` with pgvector and `invoice_search` | Send a model only what the acting user may see, never bank or password data |
| Virus scanning | `scan_status` is recorded but unused | Uploads scanned before they are downloadable | No schema change needed |
| Storage move to another provider (for example Drive to R2) | Reliable store from P5-15 in use | A copy job moves files and updates `storage_provider` and `object_key` | The adapter interface from P3-05 makes this a swap |
| Hosting or database move | Free tier limits hit | Dump and restore into the new host | Schema is plain Postgres by design |

## Risks and definition of done

The risks below come from the project docs; the phase column says where the plan handles each.

| Risk | Effect | Handled in | Fallback |
| --- | --- | --- | --- |
| Vercel Hobby terms limit use to personal, non-commercial work | Business invoices on Hobby may breach the terms | P5-10 (accepted by owner) | Move to a permitted plan or host; schema is host-independent |
| Free database pauses, starts slowly, or fills 0.5 GB | Delays or downtime; no files in the DB keeps it small | P4-04 health card, P5-09, P5-13 runbook | Optional working-hours ping; dump and restore to another host |
| Files kept in a local folder | Lost with the machine, no backups, and not kept at all on serverless hosting | P3-05 (test data only, local adapter refused in production), P5-15 gate | Do not deploy with uploads or load real data until P5-15 is done |
| Go-live store tied to one person's Google account (if Drive is chosen) | Lost access means lost files | P5-15 (dedicated account), P5-09 backups | Storage adapter allows a move to R2 |
| No backups for now | A pause, mistaken purge or lost account is unrecoverable | P5-09 gate | The 30-day undo window is the only net until then |
| App bug exposes data across roles | Cross-role data leak | P1-09, P2-04, P3-02, P5-06 | Row-level security as a second layer, audit log |
| Lost encryption key | Encrypted fields unreadable | P0-07, P5-02 rotation script | Key stored in two places outside the database |
| Permanent deletion vs tax record-keeping rules | Records needed later may be gone | P4-07 (Admin-only delete) | Delete is Admin-only; lengthen the 30-day setting if needed |
| Password-only sign-in | Weaker than two-step | Phase 7 | Rate limiting, lockout, argon2id, admin-managed resets |
| Model cost against the zero-cost aim | Unexpected bills, or no agent at all | P6-01 decision, P6-04 cap, P6-06 settings | Hard monthly cap; pause switch; free tier or small local model |
| Documents and field names leave the system for a model provider | Business data exposure | P6-01 privacy decision, P6-04 redaction filter | Choose a provider with acceptable terms, or a local model; general information, not legal advice |
| Wrong reading of a scan or handwriting | Wrong values enter invoices | P6-07 review before apply, P6-09 blank on low confidence, P6-16 evaluation | A person approves every suggestion by default |
| Prompt injection through uploaded documents | A document tries to steer the agent | P6-05 locked tools, P6-09, P6-17 tests | Agent has no locked tools and acts with the asker's role only |
| Autonomy creep | The agent is trusted more than its results justify | P6-06 levels, trust check on screen 10 | Lower the level; pause the agent |

**Definition of done for Release 1**

- [ ] Phases 0 to 5 are all `done` in `STATUS.md` with evidence on every row.
- [ ] Every end-state checklist in Phases 0 to 5 is ticked.
- [ ] CI is green: lint, typecheck, unit, database and Playwright tests, security matrix.
- [ ] Files are held in a reliable store (P5-15) before anything is deployed with real data.
- [ ] The backups gate is cleared, and the hosting and retention decisions are recorded with dates.
- [ ] A new team member can be added, work an invoice through Standard and Courier flows, and an Admin can recover from a lost password, using only the runbook.

**Definition of done for Release 2:** the Phase 6 end state, with all rows `done` and evidence on each.

**Not in Release 1:** AI features (Phase 6), automated email, two-step sign-in and virus scanning (Phase 7). **Out of scope:** Excel import (removed in the database doc) and online IFSC lookup.
