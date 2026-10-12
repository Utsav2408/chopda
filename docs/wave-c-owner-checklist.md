# Wave C — Owner checklist (GitHub & Vercel Settings)

An agent cannot click through Settings UIs. This is the complete click-path
checklist for Wave C of the
[GitHub repo checklist](invoice-tracker-github-repo-checklist.md) §3 and the
Vercel section of §2/P0-05. Do this **before the first feature PR** (it's fine
to do it after the `chore/p0-hygiene` / scaffold PRs land). Check items off as
you go and note the date; `STATUS.md` points here.

Repo: `https://github.com/Utsav2408/chopda`

## 1. GitHub → Settings → Rules → Rulesets

> **Agent-verified 2026-10-12 via the public API** (`gh` could not be
> interactively authenticated in this environment — see the note at the end
> of this section — but `GET /repos/Utsav2408/chopda/rulesets/24906179` is
> readable without auth on a public repo). The ruleset named `main` exists
> and its **rule configuration matches this checklist exactly**: `deletion`,
> `non_fast_forward`, `required_linear_history`, a `pull_request` rule with
> `required_approving_review_count: 0` and
> `required_review_thread_resolution: true`, and a `required_status_checks`
> rule requiring context `ci` with `strict_required_status_checks_policy: true`.
>
> **However, the API also reports `"enforcement": "disabled"` on this
> ruleset.** That means none of these protections are actually live on
> GitHub right now — confirmed functionally too: this session pushed commit
> `aacad8d` directly to `main` with no PR, no CI-must-pass gate, and no
> pushback from GitHub. **Action needed:** open
> GitHub → Settings → Rules → Rulesets → `main` and change **Enforcement
> status** from "Disabled" to "Active" (it's a dropdown near the top of the
> ruleset edit page, separate from the individual rule toggles below it).

Add a ruleset targeting the `main` branch:

- [x] **Restrict deletions** — rule configured (agent-verified via API 2026-10-12) — ⚠️ not enforced yet (ruleset status is "Disabled")
- [x] **Require linear history** — rule configured (agent-verified via API 2026-10-12) — ⚠️ not enforced yet
- [x] **Require a pull request before merging** — rule configured (agent-verified via API 2026-10-12) — ⚠️ not enforced yet
  - [x] Required approvals: **0** — configured as specified (agent-verified via API 2026-10-12)
  - [x] **Require conversation resolution before merging** — rule configured (agent-verified via API 2026-10-12) — ⚠️ not enforced yet
  - [x] Dismiss stale approvals: not applicable at 0 approvals, left at default (agent-verified via API 2026-10-12)
- [x] **Require status checks to pass** — rule configured, context `ci` (agent-verified via API 2026-10-12) — ⚠️ not enforced yet
  - [x] Add `ci` (the job name from `ci.yml`) as a required check (agent-verified via API 2026-10-12)
  - [x] **Require branches to be up to date before merging** — `strict_required_status_checks_policy: true` (agent-verified via API 2026-10-12) — ⚠️ not enforced yet
- [x] **Block force pushes** — `non_fast_forward` rule configured (agent-verified via API 2026-10-12) — ⚠️ not enforced yet
- [ ] **Bypass list** — could not verify emptiness via the unauthenticated API
      (bypass actors aren't in the public ruleset payload); owner confirmed
      2026-10-12, not agent-verified
- [ ] **Enforcement status: Active** — **currently "Disabled" per the API,
      2026-10-12 — this is the one real gap. Flip it, then re-push a trivial
      commit (or re-run a workflow) to confirm GitHub actually blocks a
      direct push to `main` without a passing `ci` check.**

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

> **Agent found a functional problem here on 2026-10-12, not agent-verified
> settings.** The `/actions/permissions` endpoint itself needs auth (401
> without a token, confirmed), so the toggle states below are
> owner-reported. But this session's push of commit `aacad8d` to `main`
> triggered `ci`, `security`, and `scorecard` — and **all three came back
> `"conclusion": "startup_failure"` with `0` jobs ever scheduled**
> (confirmed via `GET /actions/runs/{id}/jobs` → `total_count: 0` for all
> three run IDs). A `startup_failure` with zero jobs, on a workflow that
> parsed fine (a run record exists at all) and is triggered by a plain
> `push` (not a fork PR), is the signature of the **Actions permissions
> allow-list rejecting the SHA-pinned third-party actions** this repo's
> workflows use (`actions/checkout`, `pnpm/action-setup`,
> `actions/setup-node`, `actions/dependency-review-action`,
> `ossf/scorecard-action`, `github/codeql-action/upload-sarif`) — exactly
> the risk this checklist item calls out. **This needs owner action now,
> not later**: open Settings → Actions → General → Actions permissions,
> and if it's set to "Allow select actions and reusable workflows," add
> each action above to the allow-list (or switch to "Allow all actions and
> reusable workflows" if that's an acceptable risk trade-off for this repo).
> Then re-run the failed workflows from the Actions tab to confirm green.

- [ ] **Workflow permissions** → "Read repository contents permission" (i.e.
      the default `GITHUB_TOKEN` is read-only) (owner confirmed 2026-10-12; not agent-verified)
- [ ] **Allow GitHub Actions to create and approve pull requests** — **off** (owner confirmed 2026-10-12; not agent-verified)
- [ ] **Actions permissions** → "Allow [owner], and select non-[owner],
      actions and reusable workflows" — add this project's pinned third-party
      actions to the allow-list (currently: `actions/checkout`,
      `actions/setup-node`, `actions/upload-artifact`, `pnpm/action-setup`,
      `actions/dependency-review-action`, `ossf/scorecard-action`,
      `github/codeql-action/*` — see the `uses:` lines in
      `.github/workflows/*.yml` for the exact pins) — **owner reports this is
      set, but `ci`/`security`/`scorecard` failed with `startup_failure`
      immediately after this session's push (2026-10-12, run IDs
      38200089925/38200091144/38200090534) — treat as unverified/likely
      incomplete until a green run is observed**
- [ ] **Fork pull request workflows** → require approval for all outside
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

> **Agent-verified 2026-10-12 via the public, unauthenticated API**
> (`GET /repos/Utsav2408/chopda` — these fields are visible on a public repo
> without a token): `has_wiki: false`, `has_projects: false`,
> `has_discussions: false`, `has_issues: true`, `visibility: "public"`. All
> four match this checklist's intent exactly.

- [x] **Wiki** — off (agent-verified via API 2026-10-12: `has_wiki: false`)
- [x] **Projects** — off (agent-verified via API 2026-10-12: `has_projects: false`)
- [x] **Discussions** — off (agent-verified via API 2026-10-12: `has_discussions: false`)
- [x] **Issues** — on (agent-verified via API 2026-10-12: `has_issues: true`); the
      repo already has `.github/ISSUE_TEMPLATE/bug_report.md`

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
