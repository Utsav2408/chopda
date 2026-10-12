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

## File storage (build-time default)

- During the build (Phases 0–4), files go to a local folder behind the storage
  adapter interface (`src/server/storage/`), selected by `STORAGE_PROVIDER=local`
  and configured by `FILE_STORAGE_DIR`. This folder is for test/dev data only and
  is gitignored.
- **Before any deployment that accepts uploads**, the team must switch to a
  durable provider (Google Drive or Cloudflare R2 — owner to choose, tracked as
  the open `P5-15` gate) and only then proceed. The local adapter refuses to
  start when `VERCEL_ENV=production` (see `assertNotProductionLocal()` in
  `src/server/storage/index.ts`).
- Which account (Google/Cloudflare) ends up holding the production files is an
  operational detail that stays in the owner's local private notes, not here.

## Roles, sign-in, deletes (already resolved in the phasewise plan)

- Roles: `admin` (exactly one, enforced by a partial unique index), `builder`,
  `viewer`.
- Sign-in: username + password (argon2id), own session table, long random
  tokens stored hashed. No third-party auth service.
- Delete: soft delete with a 30-day undo window, then a scheduled purge of the
  row and its stored file. The audit log is never purged. Only the Admin may
  delete; no accountant sign-off is needed.
- Backups: none for now (per the database doc); gated before real data goes in
  — see `P5-09` in `STATUS.md`.
- Bank IFSC validation: format check only (4 letters, `0`, 6 letters or digits).
  No online IFSC lookup API.

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
  A second copy (mirror clone or scheduled `git bundle`) is the mitigation —
  tracked as deferred Wave E work in `STATUS.md`, to be running before Phase 5
  go-live.

## Still open (blocks later phases, not Phases 0–4)

- [ ] Go-live file store: Google Drive or Cloudflare R2, and whose account holds
      it (`P5-15`). Does not block Phases 0–4.
- [ ] Confirm database/hosting region (`P0-03`).
- [ ] Phase 6 gates (`P6-01`): model provider, monthly cap, privacy acceptance,
      first capabilities — not asked until Release 1 is live.

## Private notes

Operational specifics that must never be public — key storage locations and
rotation steps, Neon/Vercel/Google/Cloudflare account identifiers, the full
go-live runbook — are kept in the owner's **local private notes, outside this
project folder**. This file intentionally does not name where those notes live.
