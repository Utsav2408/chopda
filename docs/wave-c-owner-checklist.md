# Wave C — Owner checklist (GitHub & Vercel Settings)

An agent cannot click through Settings UIs. This is the complete click-path
checklist for Wave C of the
[GitHub repo checklist](invoice-tracker-github-repo-checklist.md) §3 and the
Vercel section of §2/P0-05. Do this **before the first feature PR** (it's fine
to do it after the `chore/p0-hygiene` / scaffold PRs land). Check items off as
you go and note the date; `STATUS.md` points here.

Repo: `https://github.com/Utsav2408/chopda`

## 1. GitHub → Settings → Rules → Rulesets

> **Owner confirmed 2026-10-12: all of section 1 is done.** Agent could not
> verify via API — `gh` was installed in this environment but not
> authenticated (the device-login flow needs an interactive GitHub sign-in
> the agent cannot complete without the owner's credentials/passkey), so
> these are owner-reported, not agent-verified. Re-run
> `gh api repos/Utsav2408/chopda/rulesets` next time an agent has an
> authenticated `gh` session to convert these to agent-verified.

Add a ruleset targeting the `main` branch:

- [x] **Restrict deletions** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Require linear history** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Require a pull request before merging** (owner confirmed 2026-10-12; not agent-verified)
  - [x] Required approvals: **0** (solo owner — you can't approve your own PR;
        the PR + CI is still your checkpoint) (owner confirmed 2026-10-12)
  - [x] **Require conversation resolution before merging** — on (owner confirmed 2026-10-12; not agent-verified)
  - [x] Dismiss stale approvals: not applicable at 0 approvals, leave default (owner confirmed 2026-10-12)
- [x] **Require status checks to pass** (owner confirmed 2026-10-12; not agent-verified)
  - [x] Add `ci` (the job name from `ci.yml`) as a required check (owner confirmed 2026-10-12; not agent-verified)
  - [x] **Require branches to be up to date before merging** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Block force pushes** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Bypass list** — leave **empty** (so the ruleset always applies, even to
      you) (owner confirmed 2026-10-12; not agent-verified)

## 2. GitHub → Settings → General → Pull Requests

> Owner confirmed 2026-10-12; agent could not verify via API (no authenticated
> `gh` session — see note in section 1).

- [x] Allow squash merging — on; set as the only allowed merge method (turn off
      merge commit and rebase merge) (owner confirmed 2026-10-12; not agent-verified)
- [x] **Automatically delete head branches** — on (owner confirmed 2026-10-12; not agent-verified)

## 3. GitHub → Settings → Code security

> Owner confirmed 2026-10-12; agent could not verify via API (no authenticated
> `gh` session — see note in section 1).

- [x] **Dependabot alerts** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Dependabot security updates** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Grouped security updates** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Secret scanning** — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Push protection** (secret scanning) — on (owner confirmed 2026-10-12; not agent-verified)
- [x] **Code scanning → CodeQL analysis → Default setup** — enable (free on
      public repos) (owner confirmed 2026-10-12; not agent-verified)
- [x] **Private vulnerability reporting** — on (this is what `SECURITY.md`
      tells reporters to use) (owner confirmed 2026-10-12; not agent-verified)

## 4. GitHub → Settings → Actions → General

> Owner confirmed 2026-10-12; agent could not verify via API (no authenticated
> `gh` session — see note in section 1).

- [x] **Workflow permissions** → "Read repository contents permission" (i.e.
      the default `GITHUB_TOKEN` is read-only) (owner confirmed 2026-10-12; not agent-verified)
- [x] **Allow GitHub Actions to create and approve pull requests** — **off** (owner confirmed 2026-10-12; not agent-verified)
- [x] **Actions permissions** → "Allow [owner], and select non-[owner],
      actions and reusable workflows" — add this project's pinned third-party
      actions to the allow-list (currently: `actions/checkout`,
      `actions/setup-node`, `actions/upload-artifact`, `pnpm/action-setup`,
      `actions/dependency-review-action`, `ossf/scorecard-action`,
      `github/codeql-action/*` — see the `uses:` lines in
      `.github/workflows/*.yml` for the exact pins) (owner confirmed 2026-10-12; not agent-verified)
- [x] **Fork pull request workflows** → require approval for all outside
      collaborators (default-safe since you're solo; keep it even if someone
      forks) (owner confirmed 2026-10-12; not agent-verified)

## 5. GitHub → Settings → Secrets and variables → Actions

> Owner confirmed 2026-10-12; agent could not verify via API (no authenticated
> `gh` session — see note in section 1; also, this agent must never read
> secret values even if a token were available).

- [x] Confirm **no runtime secrets** are here (`DATABASE_URL`, `SESSION_SECRET`,
      `ENCRYPTION_KEY`, `CRON_SECRET` all live in Vercel only, never here) (owner confirmed 2026-10-12; not agent-verified)
- [x] Leave empty until Wave D needs a Neon API key for branch-per-PR — add it
      then, scoped as narrowly as Neon's API allows (owner confirmed 2026-10-12; still empty as of this date per owner)

## 6. GitHub → Settings → General (surface area)

> Owner confirmed 2026-10-12; agent could not verify via API (no authenticated
> `gh` session — see note in section 1).

- [x] **Wiki** — off (owner confirmed 2026-10-12; not agent-verified)
- [x] **Projects** — off (owner confirmed 2026-10-12; not agent-verified)
- [x] **Discussions** — off (or on, if you decide you want them — optional) (owner confirmed 2026-10-12; not agent-verified)
- [x] **Issues** — leave on if you want bug reports (the repo already has
      `.github/ISSUE_TEMPLATE/bug_report.md`); off is also fine solo (owner confirmed 2026-10-12; not agent-verified)

## 7. GitHub → Settings → repo-level signed commits

- [x] Skip for now (checklist explicitly defers this — no action needed)

> **Sections 8–11 (Vercel) are still the owner's to-do.** Not reviewed or
> checked by the agent in this pass — no Vercel CLI/API check was requested
> or run. Leave these unchecked until you've done them, per plan rule 5 (no
> evidence, not done).

## 8. Vercel → New Project

- [ ] Import `Utsav2408/chopda` from GitHub into your personal Vercel account
- [ ] Plan: **Hobby**
- [ ] Framework preset: Next.js (auto-detected)

## 9. Vercel → Project → Settings → Environment Variables

Add these for **Production** (and separately for **Preview**, with dev-safe
values until P1–P5 land — never put the same value for both unless it's
intentionally non-sensitive):

- [ ] `DATABASE_URL` (pooled connection string)
- [ ] `SESSION_SECRET`
- [ ] `ENCRYPTION_KEY`
- [ ] `STORAGE_PROVIDER` (`local` is **not valid for Production** — the app
      refuses to start; use this only for Preview/throwaway testing until
      `P5-15` lands a real provider)
- [ ] `CRON_SECRET`
- [ ] (Later, `P5-15`) provider keys for Google Drive or Cloudflare R2

`DATABASE_URL_DIRECT` (migrations) is **not** a Vercel runtime env var — it's
used from your machine or CI only, never by the deployed app.

## 10. Vercel → Project → Settings → Deployment Protection

- [ ] **Vercel Authentication** for Preview deployments — on (so preview URLs
      aren't publicly reachable; production stays behind the app's own login
      once Phase 1 ships)

## 11. Verify

- [ ] Trigger a deploy and confirm the preview loads `/health` and returns
      `{"status":"ok",...}` (behind Vercel Authentication)
- [ ] Mark `P0-05` as `done` in `STATUS.md` with the evidence line (no real
      URLs/IDs — just "preview health check passed, <date>")
- [ ] Mark this file's items done with a date; update `STATUS.md`'s Wave C row
      from "needs owner action" to "done" once every box above is checked
