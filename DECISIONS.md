# Decisions

Dated answers to the open decisions in the project docs. This file is public —
**no account names, key storage locations, server/project IDs, or other
operational specifics ever go here.** Those live in the owner's local private
notes, kept outside this repository (see the note at the end of this file).

## D1–D5 (resolved 11 Oct 2026)

| #   | Decision     | Answer                                          | Consequence                                                                                                                                                                                                                 |
| --- | ------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Account type | Personal GitHub account                         | Vercel Hobby can deploy it; no GitHub organisation needed.                                                                                                                                                                  |
| D2  | Visibility   | **Public**                                      | Code scanning, secret scanning, push protection, rulesets and Actions minutes are free. Trade-off: code, schema and planning docs are readable by anyone — security rests on auth, RLS and rate limiting, never on secrecy. |
| D3  | Owner        | Solo                                            | No collaborators for now. Review rules are adapted (0 required PR approvals; the owner's own read of the diff + CI is the gate). A code mirror/backup substitutes for a second admin (see "Repo backup" below).             |
| D4  | Licence      | **None for now**                                | Default copyright applies: people can view and fork on GitHub but cannot legally reuse the code. README states "All rights reserved." Revisit if the project is open-sourced later.                                         |
| D5  | Deploys      | Owner's personal Vercel account, **Hobby plan** | Single seat is fine for a solo owner. Hobby's non-commercial terms are an accepted risk (tracked as `P5-10`); revisit if usage limits are hit or the terms are enforced.                                                    |

## Package manager and runtime (Phase 0 defaults)

- **Package manager:** pnpm (`packageManager` field in `package.json`; lockfile
  `pnpm-lock.yaml` is committed and CI installs with `--frozen-lockfile`).
- **Node.js:** pinned to the current LTS line at the time of writing (Node 24,
  "Krypton" — see `.nvmrc` and `engines` in `package.json`). Bump both together
  when the next LTS line is ready for adoption; don't track `latest`.

## File storage

- **Build-time (Phases 0–B8):** local folder behind the storage adapter
  (`STORAGE_PROVIDER=local`, `FILE_STORAGE_DIR`). Test/dev data only; gitignored.
  The local adapter refuses to start in production (see
  `assertNotProductionLocal()` in `src/server/storage/index.ts`).
- **Go-live store (resolved 14 Oct 2026):** **Cloudflare R2**, Standard class
  only. Free-tier rules, credentials model, and agent runbook live in
  [`docs/invoice-tracker-cloudflare-r2-agent-guide.md`](docs/invoice-tracker-cloudflare-r2-agent-guide.md).
  Production switches via `STORAGE_PROVIDER=r2` at gate `B9-08h` / `P5-15`.
  Which Cloudflare account holds the bucket is an operational detail kept in
  the owner's local private notes, not here.

## Roles, sign-in, deletes, flows, waiting (resolved)

- Roles: `admin` (exactly one, enforced by a partial unique index), `builder`,
  `viewer`.
- **Builder may publish flows** (resolved 14 Oct 2026): Admin and Builder may
  create, edit, publish, and archive flows. Viewer is read-only on flows.
- Sign-in: username + password (argon2id), own session table, long random
  tokens stored hashed. No third-party auth service.
- **Session TTL = 24 hours** (resolved 21 Oct 2026): absolute lifetime from
  creation and idle timeout from `last_seen_at` are both 24 hours (was 30d /
  7d in B2-02). Opaque cookie only; user details loaded from the DB on resolve.
- Delete: soft delete with a 30-day undo window, then a scheduled purge of the
  row and its stored file. The audit log is never purged. Only the Admin may
  delete; no accountant sign-off is needed.
- **Waiting threshold default: 3 days** (resolved 14 Oct 2026): configurable;
  Waiting = current step open longer than this threshold.
- **Release 1 step field types** (resolved 14 Oct 2026): `file`, `text`,
  `confirm`, and optional `date` / `number` (per B4-01).
- Backups: **deferred for in-house v1** (resolved 21 Oct 2026) — see
  "In-house scope" below. Accept Neon + R2 provider durability; no second
  backup provider or formal restore drill until the owner opts in.
- Bank IFSC validation: format check only (4 letters, `0`, 6 letters or digits).
  No online IFSC lookup API.

## In-house scope (resolved 21 Oct 2026)

Chopda is a **small private in-house app** for a solo owner. Heavy ops gates
that matter for a multi-tenant or regulated product are **explicitly deferred**
so Release 1 can stay usable without ceremony. Revisit if real customer data,
more users, or external compliance shows up.

| Deferred | Was | Why deferred now | Revisit when |
| --- | --- | --- | --- |
| `P5-09` / `B9-07` / `B9-08i` | Second backup provider + restore drill | Neon + Cloudflare R2 already hold DB/files; dual-provider backup is overkill for low volume | Data loss would hurt beyond "rebuild from invoices," or a second person depends on the app |
| `P5-13` / `B9-09` | Formal private go-live runbook sign-off | Owner operates the stack day-to-day; a long runbook can wait | Onboarding anyone else, or after a real incident |
| `B9-10` / Wave E mirror | Repo mirror / `git bundle` + full history re-scan | GitHub + gitleaks CI is enough for solo; D3 mirror remains nice-to-have | Before open-sourcing, or if GitHub access is a single point of failure you care about |
| `B9-03` live 5k | Fill real p95 numbers in `docs/perf-notes.md` | Harness exists; synthetic 5k load is not needed at current scale | Lists feel slow, or before inviting a larger team |
| `B9-11` `backend-freeze` tag | Owner tag after every freeze box | UI (U1–U5) already shipped against the merged backend; freeze tag adds no product value | Optional; skip unless you want a historical marker |

**Still in force:** auth + role checks on the server, R2 private storage
(`P5-15`), no secrets in the repo, Phase 6 stays gated, encryption-key
locations stay in private notes only.

## Encryption key storage (`P0-07`) — reminder only, details stay private

- The `ENCRYPTION_KEY` used for field-level encryption (bank details, PAN, etc.)
  must be stored in **two places outside this repository and outside the
  database**, with documented rotation steps.
- **Where** those two locations are, and the exact rotation runbook, are kept in
  the owner's **local private notes** (see below) — not in this file, not in any
  committed doc, and not pasted into any agent chat or prompt.
- This row stays `todo` in `STATUS.md` until the owner has actually done it and
  confirmed the two locations exist (naming them only in the private notes).

## Go-live runbook (`P5-13`) — reminder only

- The full go-live runbook (add/reset users, transfer Admin, rotate the
  encryption key, restore from backup, free-tier-pause response, file-store
  access/recovery) is written and kept in the owner's **local private notes**,
  outside this project folder — not in `docs/`, not in this file.
- A redacted pointer to its existence is all that lives here; this is
  intentional per the public-repo precautions in
  `docs/invoice-tracker-github-repo-checklist.md`.

## Repo backup (checklist §9)

- Because the owner is solo (D3), the repo has no second admin as a safety net.
  A second copy (mirror clone or scheduled `git bundle`) remains the long-term
  mitigation — **deferred for in-house v1** (21 Oct 2026; see "In-house scope").
  GitHub + CI secret scanning is the interim control.

## Database / hosting regions (`P0-03` / `B0-12`) — resolved 20 Oct 2026

## (Vercel wiring updated 21 Oct 2026)

Neon pins region **per project** (not per branch), so Chopda uses two projects:

| Env                         | Neon region                             | Purpose                                     |
| --------------------------- | --------------------------------------- | ------------------------------------------- |
| Local (`pnpm dev`)          | AWS Asia Pacific (Singapore)            | Low latency for the owner in India          |
| Vercel Preview + Production | AWS US East (Ohio), `production` branch | Same DB as go-live; close to Vercel US East |

Same migrations are applied to both projects. Local `.env` and Neon CLI context
target the Singapore project; Vercel `DATABASE_URL` (Preview and Production)
points at the US East production branch. Operational project identifiers stay in
the owner’s private notes.

## Still open (blocks later phases, not Phases 0–4)

- [ ] Phase 6 gates (`P6-01`): model provider, monthly cap, privacy acceptance,
      first capabilities — not asked until Release 1 is live.

## Private notes

Operational specifics that must never be public — key storage locations and
rotation steps, Neon/Vercel/Google/Cloudflare account identifiers, the full
go-live runbook — are kept in the owner's **local private notes, outside this
project folder**. This file intentionally does not name where those notes live.
