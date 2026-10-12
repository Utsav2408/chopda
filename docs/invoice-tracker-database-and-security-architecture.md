# Invoice Tracker: Database and Data Security Architecture

Draft dated 2026-10-11. Companion to `invoice-tracker-idea-problem-research-solution.md` and `invoice-tracker-wireframes.md`. Full version with diagram: https://claude.ai/code/artifact/9c25cede-17bd-4f08-9934-1732d39c7665

## Summary

Use one PostgreSQL database as the system of record for everything structured. Keep invoice files in private storage (a local folder while building, a reliable store at go-live) with only references in the database. Design every table so AI features can be added later without a rebuild.

## Decisions so far

| Area | Decision |
| --- | --- |
| Database | PostgreSQL on Neon (free) to start. Keep the schema plain Postgres so moving to Supabase or self-hosted is a dump and restore |
| File storage | A local folder behind a storage adapter while building (test data only). Before go-live, switch to a reliable store: Google Drive (needs a fuller OAuth setup than is ready now) or Cloudflare R2 |
| Files in the database | Never. The `documents` table stores references only (storage key in `object_key`) |
| Delete behaviour | Nothing is deleted automatically. A user's explicit Delete hides the item and starts a 30-day undo window. After 30 days a scheduled job permanently purges the row and its stored file. The audit log is never purged |
| Backups | None for now. Revisit before real business data goes in |
| Cache layer (Redis etc.) | Not needed. Use indexes, short Next.js caching for dashboard counts, pooled connections |
| Excel import | Removed from scope. Existing records are entered by hand, or the tracker starts with new invoices only |
| Sign-in | Username and password (argon2id), role-based access, as in the main doc |

Note: the main doc and wireframes still mention Excel import (Phase 3 and the "Import from Excel" button). This doc supersedes them on that point.

## Storage options considered

Postgres fits because the data is relational, flow definitions need flexible fields (JSONB), and the same engine can later hold AI embeddings (pgvector). Alternatives (SQLite/Turso, Sheets/Airtable, MongoDB Atlas) were rejected: weak per-user controls, no real relations or versions, or awkward joins.

Neon vs Supabase (free tiers, as researched October 2026, not re-checked on vendor sites):

- Neon: compute suspends when idle; first request after idle sees a cold start of about 0.4 to 0.75 seconds. Wakes automatically. Pooled connection string helps. 0.5 GB per project.
- Supabase: no cold start while active, but free projects pause after 7 days of inactivity and need a manual restore. 500 MB database, 2 active projects. Auth, storage and edge functions are not needed here.
- Chosen: Neon, because a weekly pause is a worse failure than a short cold start. Pick the database region nearest the team and set hosting functions to the same region (not verified which regions the free plans offer).

## Core schema (ten tables)

Stable facts get real columns. Anything a team can reshape without a developer (flow fields, step answers) goes in JSONB. Every row carries who and when.

| Table | Holds | Key columns |
| --- | --- | --- |
| `users` | Sign-in identity and role | `username` (unique), `password_hash`, `role`, `is_active`, profile fields |
| `sessions` | Signed-in devices | `token_hash`, `expires_at`, `user_agent`, `last_seen_at` |
| `company_profile` | One row of shared company details | legal name, tax IDs, invoice defaults, optional bank details (encrypted) |
| `flow_templates` | A named flow such as Standard delivery | `name`, `status` (draft, published, archived) |
| `flow_versions` | Frozen snapshot of a template | `template_id`, `version_no`, `published_at` |
| `flow_steps` | Ordered steps of one version | `version_id`, `position`, `name`, `instructions`, `allowed_role`, `fields` (JSONB) |
| `invoices` | One tracked invoice | `invoice_no`, `flow_version_id`, `current_step_id`, `status`, `amount_minor`, `currency`, `due_date`, `owner_id` |
| `invoice_steps` | Progress of one invoice on one step | `invoice_id`, `flow_step_id`, `status`, `completed_by`, `completed_at`, `data` (JSONB) |
| `documents` | File references, never file bytes | `invoice_step_id`, `object_key`, `storage_provider`, `sha256`, `mime_type`, `size_bytes`, `uploaded_by` |
| `audit_log` | Append-only history | `actor_id`, `action`, `entity`, `entity_id`, `before`, `after`, `at` |

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TYPE user_role AS ENUM ('admin', 'builder', 'viewer');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      citext NOT NULL UNIQUE,
  password_hash text   NOT NULL,              -- argon2id, never plain text
  role          user_role NOT NULL DEFAULT 'viewer',
  is_active     boolean NOT NULL DEFAULT true,
  display_name  text NOT NULL,
  email         text,
  phone         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Exactly one Admin, enforced by the database itself
CREATE UNIQUE INDEX one_admin ON users (role) WHERE role = 'admin';

CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no       text NOT NULL UNIQUE,
  flow_version_id  uuid NOT NULL REFERENCES flow_versions(id),
  current_step_id  uuid REFERENCES flow_steps(id),
  status           text NOT NULL DEFAULT 'open',   -- open, waiting, completed, cancelled
  party_name       text NOT NULL,
  amount_minor     bigint NOT NULL CHECK (amount_minor >= 0), -- paise, not rupees
  currency         char(3) NOT NULL DEFAULT 'INR',
  issue_date       date NOT NULL,
  due_date         date,
  owner_id         uuid NOT NULL REFERENCES users(id),
  extra            jsonb NOT NULL DEFAULT '{}',
  created_by       uuid NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz                      -- set only when a user clicks Delete
);
CREATE INDEX invoices_status_due ON invoices (status, due_date) WHERE deleted_at IS NULL;
```

Design choices:

- Money is stored as whole numbers (`amount_minor`, paise), so totals never suffer rounding drift.
- Soft delete: `deleted_at` is set only when a user clicks Delete. Rows and files are physically removed only after the 30-day undo window ends.
- UUID keys, so identifiers are not guessable in URLs.

## Flows and step data

A published flow version is immutable. Each invoice points at the version it started on. Editing a flow creates version N+1, so running invoices never change under the team.

Each step declares its fields as a small JSON list; each invoice step stores the answers as JSON. File fields store a document ID, never a path.

```json
// flow_steps.fields: what the step asks for
[
  { "key": "challan",    "label": "Delivery challan",       "type": "file",    "required": true },
  { "key": "courier",    "label": "Courier name",           "type": "text",    "required": true },
  { "key": "email_sent", "label": "I have sent the email",  "type": "confirm", "required": true },
  { "key": "email_proof","label": "Email proof",            "type": "file",    "required": false }
]

// invoice_steps.data: what the user entered
{ "courier": "BlueDart", "email_sent": true, "challan": "doc:7f3a...", "email_proof": "doc:91bc..." }
```

Rules enforced:

- A step can be completed once: unique on (`invoice_id`, `flow_step_id`), status moves only forward.
- Steps complete in order: checked in the server action, with a trigger as backstop.
- Required fields present: validated against `flow_steps.fields` before save, plus a check that `data` is a JSON object.
- Published versions never change: a trigger blocks `UPDATE` and `DELETE` on steps of a published version.
- Standard vs Courier differ at one step: two templates share most step definitions, so the difference is a query.

## Invoice files

- While building, files go to a local folder behind a small storage adapter (put, get, delete), so the app never depends on where files live. Before go-live, switch the adapter to a reliable store.
- A local folder is for test data only: it has no backups, and on Vercel's serverless hosting it does not persist between requests or deploys.
- Gate: before the app is deployed anywhere that accepts uploads, switch to the reliable store first, then proceed. The local adapter refuses to start in production.
- Go-live candidates: Google Drive (a service account has no storage of its own, so a dedicated company Google account would own one private folder, accessed through OAuth) or Cloudflare R2.
- `documents.storage_provider` and `documents.object_key` keep storage swappable, so the move is a copy job.
- Name files by document ID, never the user's filename (kept in `original_filename`).
- Upload path: check session and role; validate type (PDF, PNG, JPG, optionally DOCX, XLSX) and a size cap such as 10 MB; compute `sha256` (also catches duplicates); write the file, then insert the `documents` row; if the insert fails, remove the orphaned file.
- Download path: `api/files/[id]` checks session, role and invoice access, logs the view in `audit_log`, then streams the file or issues a short-lived link (60 seconds). No public URLs.
- `scan_status` is recorded so virus scanning can be added later without a schema change.

## Securing personal and company data

Layers, each working even if the one above fails:

| Layer | Control | Protects against |
| --- | --- | --- |
| Network | TLS everywhere; database accepts only the app's connection string | Eavesdropping, direct database access |
| Sign-in | argon2id hashes, login rate limiting, lockout, long random session tokens stored hashed | Stolen dump, brute force |
| Authorisation | Role check in `middleware.ts` and again in every server action | A hidden button being bypassed |
| Database | Row-level security with role-aware policies; app connects as a limited role, never the owner | App bugs that skip a check |
| Field encryption | Bank details and PAN encrypted in the app (AES-256-GCM), key held outside the database | Leaked data, curious admin |
| Files | Private storage, permission-checked download, short-lived links | Guessable or shared URLs |
| Audit | Append-only `audit_log` for sign-ins, file views, step changes, role changes, deletes, undos | Disputes and silent tampering |

Data sensitivity:

- Passwords: critical. Hash only. Admin reset issues a one-time temporary password.
- Bank account details: high. Field-encrypted, hidden from Viewers, optional.
- Tax IDs: PAN field-encrypted; GSTIN is semi-public and can stay plain.
- User phone and email: medium. Visible to Admin and the owner only.
- Invoices, amounts and documents: business-confidential, role-gated.

Row-level security in practice: Viewers get `SELECT` only. Builders write invoices and steps but cannot touch `users` or `company_profile`. Only the Admin writes `company_profile` and user rows. Set the acting user per request inside a transaction (`SET LOCAL app.user_id = ...`) and let policies read it. Revoke `UPDATE` and `DELETE` on `audit_log` from the app role.

Privacy note: names, phones and emails are personal data under India's Digital Personal Data Protection Act, 2023. Collect only what the screens need. This is general information, not legal advice.

## AI-ready design (later phase)

Nothing AI-specific is built in Phase 1. Four habits keep Phase 4 an addition, not a migration:

1. Structured first: amounts, dates, parties and statuses are real columns, so questions are exact SQL.
2. Every file is hashed and typed (`sha256`, `mime_type`, `scan_status`), giving extraction jobs a clean queue.
3. AI output is stored apart from confirmed data. Extracted values never overwrite `invoices` directly; they land in a review table first.
4. Everything is attributable: `audit_log` records whether an actor was a person or a job.

Future tables: `document_extractions` (text and fields an AI read, with status pending/accepted/rejected), `document_chunks` (text pieces plus `embedding vector(1024)` using pgvector), `invoice_search` (full-text index), `ai_jobs` (work queue and cost control). pgvector keeps keyword and meaning-based search in the one Postgres, with the same permission rules. Send a model only what the acting user may already see, never bank details or password data.

## Performance

No cache system. At 3 to 5 users and a few thousand invoices, Postgres with the right indexes is fast enough. Use indexes for the wireframe filters (status, due date, owner, flow), short Next.js caching for dashboard counts (30 to 60 seconds), Neon's pooled connection string, and optionally a scheduled ping in working hours to avoid cold starts. Revisit only if real slowness is measured.

## Retention and backups

- Retention: nothing is deleted automatically. Explicit Delete starts a 30-day undo window (setting kept in one place), then permanent purge of the row and its stored file. The audit log is never purged and records every delete and undo.
- Backups: none for now. Until they exist, a free-tier pause, a mistaken purge or a lost account cannot be recovered. The only safety nets are the 30-day undo window and whatever history Neon and the file store keep themselves. The invoice database is the one whose loss becomes a tax problem, so revisit before real business data goes in.
- Indian tax rules generally expect invoice records to be kept for years, so confirm with an accountant before relying on permanent deletion.

## Risks

- Free database pauses or hits 0.5 GB: files stay out of the database, schema stays plain Postgres, no backups yet.
- Files in a local folder, or tied to one Google account: the local folder is for test data only; choose a reliable store before go-live, and if Drive, use a dedicated company account as owner.
- Vercel Hobby non-commercial terms (from the main doc): revisit hosting before real data goes in. The database design is host-independent.
- App bug exposes data across roles: row-level security as a second layer, role checks in server actions, audit log.
- Lost encryption key: store in two places outside the database and document rotation.
- No backups for now: revisit before real business data goes in.

## Open decisions

- [ ] Choose the go-live file store (Google Drive or Cloudflare R2) before real data goes in.
- [ ] Decide whether bank details are stored in the app at all. If not, drop the encrypted columns.
- [ ] Decide who may click Delete (Admin only is the safer choice) and confirm with an accountant that permanent removal after 30 days is acceptable.
- [ ] Confirm the three roles and the single-Admin rule.
- [ ] Confirm database and hosting region.
- [ ] Revisit backups before real data goes in.
