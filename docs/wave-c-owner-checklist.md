# Wave C — Owner checklist (GitHub & Vercel Settings)

An agent cannot click through Settings UIs. This is the complete click-path
checklist for Wave C of the
[GitHub repo checklist](invoice-tracker-github-repo-checklist.md) §3 and the
Vercel section of §2/P0-05. Do this **before the first feature PR** (it's fine
to do it after the `chore/p0-hygiene` / scaffold PRs land). Check items off as
you go and note the date; `STATUS.md` points here.

Repo: `https://github.com/Utsav2408/chopda`

## 1. GitHub → Settings → Rules → Rulesets

> **Agent-verified 2026-10-12 via an authenticated `gh` session**
> (`gh auth status` → logged in as `Utsav2408`, scopes `repo`/`workflow`).
> `GET /repos/Utsav2408/chopda/rulesets/24906179` now reports
> **`"enforcement": "active"`** (previously `"disabled"` in the prior pass) —
> the owner's fix landed. The rule configuration still matches this checklist
> exactly, and this time the empty-bypass-list item is independently
> verifiable too: `"bypass_actors": []` and `"current_user_can_bypass":
> "never"` — no bypass actors exist, not even for the owner.
>
> **Functional proof, not just config inspection**: this session created a
> branch, committed, and ran `git push origin <branch>:main` directly. GitHub
> **rejected it** with `GH013: Repository rule violations found for
> refs/heads/main` — `"Changes must be made through a pull request"` and
> `"Required status check \"ci\" is expected"`. The branch was deleted
> immediately after the test; nothing was merged. Direct pushes to `main` are
> now actually blocked, not just configured.

- [x] **Restrict deletions** — rule configured and **enforcement active** (agent-verified via authenticated API + functional push test, 2026-10-12)
- [x] **Require linear history** — rule configured and **active** (agent-verified 2026-10-12)
- [x] **Require a pull request before merging** — rule configured and **active**; confirmed functionally (direct push rejected) (agent-verified 2026-10-12)
  - [x] Required approvals: **0** — configured as specified (agent-verified 2026-10-12)
  - [x] **Require conversation resolution before merging** — rule configured and **active** (agent-verified 2026-10-12)
  - [x] Dismiss stale approvals: not applicable at 0 approvals, left at default (agent-verified 2026-10-12)
- [x] **Require status checks to pass** — rule configured, context `ci`, **active**; confirmed functionally (push rejected citing `"Required status check \"ci\" is expected"`) (agent-verified 2026-10-12)
  - [x] Add `ci` (the job name from `ci.yml`) as a required check (agent-verified 2026-10-12)
  - [x] **Require branches to be up to date before merging** — `strict_required_status_checks_policy: true` (agent-verified 2026-10-12)
- [x] **Block force pushes** — `non_fast_forward` rule configured and **active** (agent-verified 2026-10-12)
- [x] **Bypass list** — **empty**, confirmed via authenticated API: `"bypass_actors": []`, `"current_user_can_bypass": "never"` (agent-verified 2026-10-12; previously owner-confirmed only)
- [x] **Enforcement status: Active** — confirmed via authenticated API (`"enforcement": "active"`) **and** functionally (direct push to `main` rejected by GitHub) (agent-verified 2026-10-12) — **this item is now fully settled.**

## 2. GitHub → Settings → General → Pull Requests

> **Agent-verified 2026-10-12 via authenticated API** (`GET
> /repos/Utsav2408/chopda`).

- [x] Allow squash merging — **confirmed**: `allow_squash_merge: true`,
      `allow_merge_commit: false`, `allow_rebase_merge: false` — squash is the
      only allowed method (agent-verified 2026-10-12)
- [x] **Automatically delete head branches** — **confirmed**:
      `delete_branch_on_merge: true` (agent-verified 2026-10-12)

## 3. GitHub → Settings → Code security

> **Agent-verified 2026-10-12 via authenticated API.** One real gap was found
> and fixed in this pass (CodeQL language coverage — see below).

- [x] **Dependabot alerts** — on, confirmed (`GET
      /repos/.../vulnerability-alerts` → `204 No Content`, which per the API
      contract means enabled) (agent-verified 2026-10-12)
- [x] **Dependabot security updates** — on, confirmed (`GET
      /repos/.../automated-security-fixes` → `{"enabled":true,"paused":false}`)
      (agent-verified 2026-10-12)
- [x] **Grouped security updates** — confirmed via `.github/dependabot.yml`:
      both the `npm` and `github-actions` ecosystems use a `groups:` block
      with pattern `"*"` (agent-verified 2026-10-12)
- [x] **Secret scanning** — on, confirmed (`security_and_analysis.secret_scanning.status:
      "enabled"`) (agent-verified 2026-10-12)
- [x] **Push protection** (secret scanning) — on, confirmed
      (`secret_scanning_push_protection.status: "enabled"`) (agent-verified 2026-10-12)
- [x] **Code scanning → CodeQL analysis → Default setup** — **fixed in this
      pass**. It was enabled but misconfigured: `GET
      /code-scanning/default-setup` showed `"languages": ["actions"]` only —
      CodeQL was scanning the GitHub Actions workflow YAML but **not the
      actual TypeScript/JavaScript app code** (repo language breakdown:
      TypeScript 14,838 / JavaScript 4,297 bytes). Fixed via `PATCH
      /code-scanning/default-setup` adding `javascript-typescript` to the
      language list (with the owner's authenticated token, no workflow file
      changes). Triggered a `CodeQL Setup` run (`run_id 38201725986`) that
      completed `success` with two analysis jobs — `Analyze (actions)` and
      `Analyze (javascript-typescript)`, both green. Re-fetched config now
      shows `"languages": ["actions","javascript","javascript-typescript","typescript"]`.
      Queried `GET /code-scanning/alerts?tool_name=CodeQL` afterwards: **0
      alerts** in the app code (agent-fixed-and-verified 2026-10-12)
- [x] **Private vulnerability reporting** — on, confirmed
      (`GET /private-vulnerability-reporting` → `{"enabled":true}`) (agent-verified 2026-10-12)

## 4. GitHub → Settings → Actions → General

> **Agent found and fixed a real bug in this pass.** The previous session's
> `startup_failure`/0-jobs diagnosis (allow-list rejecting SHA-pinned
> actions) was correct in spirit but the root cause was more specific than
> "owner hasn't added them yet": **the owner (or a prior tool) had already
> added every needed action name to the allow-list, but as bare `owner/repo`
> patterns with no `@ref` suffix** (e.g. `actions/checkout`, not
> `actions/checkout@*`). GitHub's allow-list pattern syntax requires an
> explicit ref component — `OWNER/REPOSITORY@TAG-OR-SHA` or a ref wildcard
> like `OWNER/REPOSITORY@*` — to match any actual SHA-pinned `uses:` line. A
> bare `owner/repo` with no `@` never matches a real `uses:` reference (which
> always has a ref), so **every single one of this repo's SHA-pinned actions
> was being silently rejected despite being "in the list."** Confirmed via
> the exact GitHub Actions annotation text on a fresh `workflow_dispatch` run
> of `scorecard.yml` (run `38200973959`, before the fix):
> `"The actions actions/checkout@<sha> and ossf/scorecard-action@<sha> are
> not allowed in Utsav2408/chopda because all actions must be from a
> repository owned by Utsav2408 or match one of the patterns: actions/checkout,
> actions/dependency-review-action, actions/setup-node,
> actions/upload-artifact, github/codeql-action/*, ossf/scorecard-action,
> pnpm/action-setup."` — the listed patterns are exactly what was configured,
> and yet they still didn't match, because of the missing `@ref`.
>
> **Fixed via `PUT /repos/Utsav2408/chopda/actions/permissions/selected-actions`**
> (using the owner's authenticated `gh` token, no workflow file changes
> needed) — every pattern now carries a `@*` ref wildcard:
> `actions/checkout@*`, `actions/setup-node@*`, `actions/upload-artifact@*`,
> `pnpm/action-setup@*`, `actions/dependency-review-action@*`,
> `ossf/scorecard-action@*`, `github/codeql-action/*@*`.
>
> **Verified the fix works**: re-ran `scorecard.yml` via `workflow_dispatch`
> (run `38201109877`) — it went from an instant `startup_failure` to actually
> executing and completing `success` in 25s. CodeQL default-setup (§3 above)
> also ran clean under the same corrected allow-list. The `ci`/`security`
> workflows were exercised via this pass's own docs PR (see `STATUS.md` Wave
> B4 row for the resulting run IDs/conclusions) to confirm the fix holds for
> `pull_request`-triggered runs too, not just `workflow_dispatch`.

- [x] **Workflow permissions** → "Read repository contents permission" —
      confirmed: `GET /actions/permissions/workflow` →
      `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}`
      (agent-verified 2026-10-12)
- [x] **Allow GitHub Actions to create and approve pull requests** — off,
      confirmed in the same response above (`can_approve_pull_request_reviews: false`)
      (agent-verified 2026-10-12)
- [x] **Actions permissions** → "Allow select actions and reusable
      workflows" — confirmed `allowed_actions: "selected"`; **the pattern
      list itself had a real bug (missing `@ref`) and has been fixed** — see
      the note above. Current, correct pattern list: `actions/checkout@*`,
      `actions/setup-node@*`, `actions/upload-artifact@*`,
      `pnpm/action-setup@*`, `actions/dependency-review-action@*`,
      `ossf/scorecard-action@*`, `github/codeql-action/*@*` — matches every
      `uses:` line across `.github/workflows/*.yml` (agent-fixed-and-verified 2026-10-12)
- [ ] **Fork pull request workflows** → require approval for all outside
      collaborators — **could not be verified via REST API** for this repo
      (no corresponding read endpoint was found; this setting may only be
      exposed in the Settings UI for personal-account repos). Low risk for a
      solo-maintainer public repo with no outside collaborators today, but
      the owner should still confirm it in Settings → Actions → General →
      "Fork pull request workflows from outside collaborators" the next time
      they're in that screen (owner action, not blocking)

## 5. GitHub → Settings → Secrets and variables → Actions

> Owner confirmed 2026-10-12; this agent still cannot and did not read any
> secret values or list secret names in a way that would expose them — only
> confirmed via the owner's prior statement that the list is empty.

- [x] Confirm **no runtime secrets** are here (`DATABASE_URL`, `SESSION_SECRET`,
      `ENCRYPTION_KEY`, `CRON_SECRET` all live in Vercel only, never here) (owner confirmed 2026-10-12)
- [x] Leave empty until Wave D needs a Neon API key for branch-per-PR — add it
      then, scoped as narrowly as Neon's API allows (owner confirmed 2026-10-12, still empty)

## 6. GitHub → Settings → General (surface area)

> **Agent-verified 2026-10-12 via authenticated API**
> (`GET /repos/Utsav2408/chopda`): `has_wiki: false`, `has_projects: false`,
> `has_discussions: false`, `has_issues: true`, `visibility: "public"`. All
> four match this checklist's intent exactly.

- [x] **Wiki** — off (agent-verified via API 2026-10-12: `has_wiki: false`)
- [x] **Projects** — off (agent-verified via API 2026-10-12: `has_projects: false`)
- [x] **Discussions** — off (agent-verified via API 2026-10-12: `has_discussions: false`)
- [x] **Issues** — on (agent-verified via API 2026-10-12: `has_issues: true`); the
      repo already has `.github/ISSUE_TEMPLATE/bug_report.md`

## 7. GitHub → Settings → repo-level signed commits

- [x] Skip for now (checklist explicitly defers this — no action needed)

> **GitHub side (§1–7) is now fully settled as of 2026-10-12** — every item
> above is agent-verified via an authenticated API/functional test, with the
> two real bugs found in the prior pass (ruleset enforcement disabled, and
> this pass's new find: the Actions allow-list `@ref` bug) both confirmed
> fixed. The one unchecked item (§4 fork PR approval) is a non-blocking,
> UI-only setting that doesn't affect this solo-maintainer repo today.
>
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
