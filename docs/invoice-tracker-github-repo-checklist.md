# Invoice Tracker: GitHub Repo Checklist

Draft dated 2026-10-11, updated after the owner's decisions D1 to D5 (solo developer, public repo). Companion to `invoice-tracker-phasewise-implementation-plan.md`. Findings are from web searches in October 2026 and were not re-checked on each vendor's own page; confirm the GitHub free-tier features for public repos in Settings when you enable them.

## 1. Decisions (resolved 11 Oct 2026)

| # | Decision | Answer | Consequence |
| --- | --- | --- | --- |
| D1 | Account type | Personal account | Vercel Hobby can deploy it. No GitHub organisation needed. |
| D2 | Visibility | **Public** | Code scanning, secret scanning, push protection, rulesets and Actions minutes are free. The trade-off: the code, schema and planning docs are readable by anyone, so security must rest on auth, RLS and rate limiting, never on secrecy. See the precautions below. |
| D3 | Owner | You, solo | No collaborators for now. Review rules are adapted (section 3). Keep a mirror backup of the code (section 9), because there is no second admin. |
| D4 | Licence | None for now | With no licence file, default copyright applies: people can view and fork on GitHub but cannot legally reuse the code. Optionally add one line to the README saying "All rights reserved". Revisit if you open-source it. |
| D5 | Deploys | Your Vercel account | Single seat is fine for a solo owner. Hobby's non-commercial terms remain the accepted risk (P5-10). |

### Public repo precautions

- **Keep these out of the repo:** real names, emails, GSTIN/PAN, bank details, production URLs, Neon project IDs, which Google or Cloudflare account holds files, key locations and rotation steps, and any customer or invoice data. This affects the plan: P0-07 (key locations in `DECISIONS.md`) and P5-13 (runbook) should be kept in a **private place** (a private notes file or separate private repo). The public `docs/` holds redacted versions.
- **Fixtures and evidence are synthetic.** Test PDFs, seed data, and screenshots pasted into `STATUS.md` must contain no real data.
- **Scan history before the first push** (`gitleaks detect`), and never commit a `.env` file. On a public repo, a leaked secret is exploited within minutes; rotate it even after deleting.
- **Strangers can fork and open PRs.** Set Actions to require approval for workflows from outside contributors, never use `pull_request_target`, and rely on the default that fork PRs get no secrets.
- **Preview deployments:** turn on Vercel Authentication for previews so they are not publicly reachable. The production app is behind login, but attackers can read your code, so rate limiting, lockout and RLS (already in the plan) matter more.
- **Trim the surface:** turn off Wiki, Projects and Discussions; leave Issues on only if you want them.

## 2. Repo contents (files to create in Phase 0)

| File | Purpose | Notes |
| --- | --- | --- |
| `README.md` | Run, test, migrate, deploy | Already P0-06. Add architecture link, env var table, and "no real data in dev". |
| `.gitignore` | Keep secrets and data out | Include `.env*` (except `.env.example`), `FILE_STORAGE_DIR` folder, `.next/`, `node_modules/`, coverage, Playwright reports, `*.pem`, any dump files, `CLAUDE.local.md`, `.claude/settings.local.json`. |
| `.env.example` | Names of variables, no values | Mark which are server-only. Never prefix secrets with `NEXT_PUBLIC_`; those values are shipped to the browser. |
| `.nvmrc` and `engines` in `package.json` | Same Node version for everyone and CI | Pin one LTS version. |
| Lockfile (`pnpm-lock.yaml` or `package-lock.json`) | Reproducible installs | Commit it, install with `--frozen-lockfile` (or `npm ci`) in CI. |
| `.editorconfig`, Prettier, ESLint, `tsconfig` with `strict` | Consistent code | ESLint rule: ban client imports of server modules. |
| `SECURITY.md` | How to report a vulnerability | Say: do not use public issues; email the owner; turn on GitHub private vulnerability reporting. |
| `.github/CODEOWNERS` | Low value while solo; add when a second person joins | Would cover `db/migrations/`, `lib/auth/`, `lib/storage/`, `lib/crypto/`, `.github/workflows/`. |
| `.github/pull_request_template.md` | Checklist on every PR | Work item ID (P3-04), tests added, migration included, role re-check done, no secrets, evidence pasted. |
| `.github/ISSUE_TEMPLATE/` | Bug and task forms | Optional for 3 to 5 people; one bug form is enough. |
| `.github/dependabot.yml` | Update npm packages **and** GitHub Actions | Weekly, grouped updates; security updates are separate and immediate. |
| `STATUS.md`, `DECISIONS.md` | Already in the plan | Keep in the repo root. |
| `docs/` | The five planning docs, ADRs | Copy the planning docs in so agents read the same source of truth. Short architecture decision records for choices such as "own session table, no auth service". |
| `AGENTS.md` | **Single source of agent rules** for Cursor and Claude Code | Cursor reads it natively. See section 10 for how Claude Code picks it up. |
| `CLAUDE.md` | Thin wrapper for Claude Code | First line `@AGENTS.md`, then Claude-only notes. Needed because Claude Code ignores `AGENTS.md` once a `CLAUDE.md` exists. |
| `.claude/settings.json` | Shared Claude Code permissions and hooks | Committed. Deny rules for secrets and dangerous commands. |
| `.cursor/rules/*.mdc` | Path-scoped Cursor rules | Optional at first; add when the agent repeats a mistake. |
| `.cursorignore` | Keep secrets out of Cursor's context | A convenience, not a security boundary (section 10). |
| `LICENSE` | Skipped for now (D4) | Optional README line: "All rights reserved". |

Suggested layout: `src/app/(auth)`, `src/app/(app)`, `src/server/` (data access layer, `server-only`), `src/server/storage/` (adapter), `db/migrations/`, `scripts/`, `tests/`, `docs/`.

## 3. Repository settings (repo Settings pages only)

Do these before the first feature PR. All live under the repo's own Settings and are free on a public repo. Account-level settings (sign-in security, profile, tokens) are deliberately out of scope for this checklist.

1. **Ruleset on `main`:** require a pull request, require the CI checks to pass and branches to be up to date, block force pushes and deletion, require linear history, require conversation resolution. Leave the bypass list empty so CI always gates. Required approvals: **0**, because you cannot approve your own PR. The PR is still your checkpoint: read the diff and CI before merging, especially for agent-written code.
2. **Merge method:** squash merge only, auto-delete merged branches, PR title becomes the commit (include the work item ID).
3. **Code security settings:** turn on Dependabot alerts, Dependabot security updates, grouped security updates, secret scanning, push protection, code scanning (CodeQL default setup) and private vulnerability reporting.
4. **Actions settings:** default workflow token read-only; do not allow Actions to create or approve PRs; allow only GitHub-owned actions plus a short allow-list; require approval for workflows from outside contributors.
5. **Secrets:** repository secrets only for what CI needs (for example a Neon API key for branch-per-PR). Runtime secrets (`DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`) live in Vercel env settings only.
6. **Collaborators:** none now. When someone joins, give write access, not admin, and add CODEOWNERS and one required approval then.
7. **Signed commits:** optional; skip until there is a reason.
8. **CI minutes:** Actions are free for standard runners on public repos, so no quota worry, but still cache dependencies and cancel superseded runs.

## 4. CI workflows (`.github/workflows/`)

Builds on P0-02 and P5-08. **Pull scanning forward: set it up in Phase 0, not Phase 5.** A secret committed in week one stays in history forever.

| Workflow | What it does | Notes |
| --- | --- | --- |
| `ci.yml` | Install with the lockfile, lint, typecheck, unit tests, build | Runs on every PR and on `main`. This is the required status check. |
| `db-tests` (job in `ci.yml`) | Start Postgres (service container or a Neon branch), apply all migrations to a blank DB, run RLS and trigger tests | Your plan depends on RLS and triggers, so test them against real Postgres, not mocks. |
| `migration-drift` (job) | Run `drizzle-kit generate` and fail if it produces new files | Catches a schema change without a committed migration. |
| `e2e.yml` | Playwright against a built app | Cache browsers; upload the report on failure. |
| `security.yml` | `gitleaks` (secrets), `npm audit --omit=dev` or `osv-scanner` (dependencies), dependency-review action on PRs | Free. Also enable **CodeQL** (free on public repos), via GitHub's default setup or a workflow. |
| `scorecard.yml` | OpenSSF Scorecard | Worth adding now that the repo is public. |
| `cron` | Not here | Vercel Cron handles purge and reminders (P4-09). |

Hardening applied to every workflow:

- Top-level `permissions: contents: read`; widen only per job and only where needed.
- **Pin third-party actions to a full commit SHA** (with the version in a comment), not a tag. Add the `github-actions` ecosystem to Dependabot so pins do not go stale.
- `actions/checkout` with `persist-credentials: false`.
- Never put `${{ github.event.* }}` text (PR title, branch name, issue body) straight into a `run:` script; pass it through an environment variable.
- Do not use `pull_request_target` unless you understand it; this project does not need it.
- `concurrency` groups so a new push cancels the old run.
- Set `timeout-minutes` on every job.
- Real secrets are never available to fork PRs. The repo is public, so keep it that way.

## 5. Database migrations in the repo

- Commit generated SQL migrations. Use `drizzle-kit generate` + `migrate` for anything real; `push` is for throwaway prototyping only.
- Your RLS policies, triggers, partial indexes and `citext` are not expressed by the ORM schema. Put them in hand-written SQL migration files (Drizzle supports custom migrations via `generate --custom`) and review them like code.
- Drizzle has no built-in rollback. Treat migrations as **forward-only**: to undo, write a new migration. Take a Neon branch or a dump before applying anything risky to production.
- Use a **Neon branch per PR** for database tests (Neon documents a GitHub Actions flow for this), deleted when the PR closes. Production migrations run only from `main`, as a deliberate step, using the **direct** connection string; the app uses the pooled one.
- The migration role (owner) and the app role (`app_user`, P1-02) use different secrets. The owner credential is never in the app's runtime env.

## 6. Next.js rules the repo should enforce

- **Upgrade to a current patched Next.js** and keep it current. Past advisories include a middleware authorisation bypass (CVE-2025-29927) and server-action issues, so do not rely on `middleware.ts` alone. Your plan already re-checks roles in every server action and route handler; keep that.
- Put all database access behind a `server-only` data access layer that authorises first and returns only the fields the screen needs.
- Treat every server action and route handler as a public HTTP endpoint: validate input (Zod), check session and role, rate-limit sensitive ones.
- Do not capture secrets or sensitive values in server-action closures; keep actions in separate files.
- `NEXT_PUBLIC_` variables are exposed to the browser. Add a CI check that fails if any such variable name contains `SECRET`, `KEY`, `TOKEN` or `PASSWORD`.
- Security headers (CSP, HSTS, frame, referrer, nosniff) set in `next.config` and tested (P5-07; add a basic version early).
- Consider React taint APIs as a second guard for password hashes and encrypted fields; they are defence in depth, not a replacement for returning less data.

## 7. Secrets and data hygiene

- Rotate anything that ever touches a commit, even if you delete it; history keeps it.
- Add a **pre-commit hook** (Husky or lefthook) running `gitleaks protect --staged`, Prettier and lint. It is a convenience; CI is the enforcement.
- Use a seeded fake dataset for dev and tests (P2-10). Never copy production data into the repo, a Neon dev branch or a test fixture.
- Sample uploads in `tests/fixtures/` must be synthetic files, never real challans or invoices.
- Keep the two stored copies of `ENCRYPTION_KEY` outside GitHub (P0-07).

## 8. Working agreements (document in `CONTRIBUTING.md`)

- Branch names: `p3-04-step-completion`. One work item per branch and PR (matches plan rule 2).
- Commit and PR titles start with the work item ID. Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) are optional but make the history easier to scan.
- PR size: small enough to review in 15 minutes; migrations in their own PR where possible.
- "Done" means the evidence is pasted in `STATUS.md` (plan rule 5).
- Tag releases `release-1`, `release-2`, and write short release notes. Tag before the go-live step so you can return to it.
- Branch for the agent layer: do not merge any Phase 6 code to `main` before its gates (plan rule 8). Add a CI check that fails if the repo contains an `agent` route or AI vendor key names before then.

## 9. Backup of the repo itself

The plan covers database and file backups (P5-09) but not the code.

- Keep a second copy: a mirror clone on another machine or a scheduled `git bundle` to your file store. Zero cost.
- Export or copy `STATUS.md`, `DECISIONS.md` and the runbook into the file store at each release.

## 10. Working with Cursor and Claude Code

Goal: both tools follow the same rules, neither can casually reach secrets or production, and every agent change still passes through a PR and CI. Findings are from the Cursor and Claude Code docs fetched in October 2026; points marked *(recommendation)* are my suggestions, not documented requirements.

### 10.1 One set of instructions, two tools

- **Write rules once in `AGENTS.md`.** Cursor supports `AGENTS.md` as plain markdown in the root or subfolders, with more specific nested files taking precedence.
- **Claude Code has a catch.** By default it reads `AGENTS.md` only when there is no `CLAUDE.md` (or `CLAUDE.local.md`) in the working directory or above. If both exist, it reads only the `CLAUDE.md` files. Reading `AGENTS.md` directly also needs a recent Claude Code version.
- **So add a thin `CLAUDE.md`** whose first line is `@AGENTS.md`, followed by anything Claude-specific. The import loads `AGENTS.md` into Claude's context, and Claude Code skips it if already loaded. A symlink also works but leaves no room for Claude-only notes and is awkward on Windows.
- **Do not create `CLAUDE.local.md`** for personal notes unless you also set Claude Code's project-instructions option to read both files; a `CLAUDE.local.md` counts as a `CLAUDE.md` and stops `AGENTS.md` loading on its own. Gitignore it anyway.

### 10.2 What goes in `AGENTS.md`

Keep it short. Claude Code targets under 200 lines per file; Cursor suggests rules under 500 lines. Longer files reduce adherence. Cursor also advises: skip anything a linter already enforces, reference files instead of copying them, and add a rule only when the agent repeats a mistake.

Starter content for this project:

1. **What this is:** one paragraph, plus links to `docs/` for the plan, schema and security design. Do not copy them in.
2. **Commands:** install, dev, lint, typecheck, test, db-test, e2e, migrate (exact commands).
3. **The plan's agent rules** (roles re-checked in every server action; no file bytes in the DB; no public file URLs; no AI features in Release 1; no deploy with uploads before P5-15).
4. **Work item discipline:** one work item per branch and PR, ID in the title, evidence in `STATUS.md`, stop and ask on open decisions.
5. **Never do:** edit an applied migration; run `drizzle-kit push` against anything but a throwaway database; read or print `.env*` files; add secrets, real names or real invoice data to any file; use `NEXT_PUBLIC_` for secrets; push to `main`.
6. **Where things live:** one line each for the data access layer, storage adapter, audit writer and migrations folder.

Because the repo is public, `AGENTS.md`, `CLAUDE.md` and `.cursor/rules` are public too: no account names, key locations or private URLs in them.

### 10.3 Instructions are not enforcement

- Claude Code's docs say `CLAUDE.md` is treated as context, not enforced configuration. To block an action regardless of what the model decides, use permission deny rules or a PreToolUse hook. Cursor's docs likewise say AI guidance should not be the only security control.
- **Claude Code `.claude/settings.json` (commit it).** Deny rules take precedence over allow and ask rules, and deny and ask rules apply immediately for teammates, while allow rules wait for folder trust.
  - `deny`: `Read(./.env)`, `Read(./.env.*)`, `Read(./secrets/**)`, `Bash(curl *)` *(recommendation: also `Read(./storage/**)` or wherever `FILE_STORAGE_DIR` points)*
  - `ask`: `Bash(git push *)`, `Bash(rm *)`, `Bash(drizzle-kit migrate *)` *(recommendation)*
  - `allow`: only specific scripts such as `Bash(pnpm run lint)`, `Bash(pnpm run test *)`; avoid broad wildcards and never use bypass-permissions mode.
- **PreToolUse hooks** (exit code 2 blocks the action) *(recommendation)*: block edits to files in `db/migrations/` that are already committed; block commands that touch a production connection string; block writes to `.env*`.
- **Personal overrides** go in `.claude/settings.local.json`, which must stay out of git. Claude Code adds it to your global git excludes when it creates the file, but add it to `.gitignore` yourself as well.

### 10.4 Cursor settings that matter

- **`.cursorignore`** blocks ignored files from Agent, Tab, Inline Edit and @-mentions, using `.gitignore` syntax. It also skips files already in `.gitignore`. Add `**/.env`, `**/.env.*`, `**/*.key`, `**/*.pem`, `**/credentials.json`, `**/secrets.json`, and the file-storage folder. Check with `git check-ignore -v <file>`.
- **It is not a security boundary.** Cursor's docs say complete protection is not guaranteed, and that terminal commands and MCP tools run by Agent are not blocked by it. A Cursor forum report shows models reading ignored files with `cat`, `head` or `sed` when asked to change them.
- **So:** keep terminal auto-run off or restricted to a short allowlist; never allowlist `cat`, `head`, `sed` or `Get-Content` in this project; leave "Ask Every Time" on for anything else.
- **Cursor rule files** live in `.cursor/rules/` as `.mdc` files (plain `.md` there is ignored), with `description`, `globs` and `alwaysApply` front matter. Commit them. Start with none beyond `AGENTS.md`; add path-scoped ones (for example for `db/migrations/**` and `src/server/**`) when the same mistake repeats. Rules that must always be in context must carry their content in the body, since referenced files are only read when needed.
- Cursor's privacy mode and data-retention settings: check them in Cursor's settings and policy pages before pointing the agent at anything sensitive. *(Not confirmed in the pages I fetched.)*

### 10.5 Keep real secrets away from the agents

The design that protects you most is that agents never have anything worth stealing:

- **Local `.env` holds dev values only:** a Neon *dev branch* with seeded fake data, a throwaway `SESSION_SECRET`, a dev-only `ENCRYPTION_KEY`, and the local storage folder. *(recommendation)*
- **Production `DATABASE_URL`, owner role credentials and the production `ENCRYPTION_KEY` are never on your laptop's project folder.** They live in Vercel env settings and your private notes.
- **Never paste production data, real invoices or screenshots with real details into a chat or prompt.** Use the synthetic fixtures.
- **MCP servers and extensions:** add only ones you need. Keep tokens out of committed MCP config files (`.mcp.json`, `.cursor/mcp.json`). Treat web pages, issues and PR text the agent reads as untrusted input: they can contain instructions aimed at the agent.
- **Pre-push scan:** the gitleaks pre-commit hook from section 7 also catches secrets an agent writes into files.

### 10.6 Review loop for agent-written code

- Agents work on a branch, never on `main`. The ruleset (section 3) enforces this even if the agent tries.
- Every PR carries the template checklist: tests added, migration included, role re-check done, evidence pasted. Read the diff yourself; with no second reviewer, CI plus your read is the only gate.
- Pay extra attention to anything touching `lib/auth`, RLS policies, migrations, the storage adapter, crypto, workflows and `.claude/` or `.cursor/` config. These are the files that change what agents and CI are allowed to do. When a second person joins, make them CODEOWNERS.
- Ask the agent to run lint, typecheck and tests itself before opening the PR, and to paste the output into `STATUS.md` evidence (plan rule 5).
- Start a fresh session per work item. Update `AGENTS.md` only when a mistake repeats, and review those edits like code.
- Optional: a CI check that fails if `.claude/settings.json` or `.cursor/` change in a PR that also changes application code, forcing agent config changes into their own PR *(recommendation)*.

## 11. Order of work

**Before the first push**
- [ ] `.gitignore`, `.env.example`, README skeleton, `SECURITY.md`; no `LICENSE` (D4)
- [ ] `gitleaks detect` clean on the full history
- [ ] Decide where the private notes (key locations, account names, runbook details) live

**Phase 0 (extends P0-02 and P0-06)**
- [ ] Ruleset on `main` as in section 3; squash merge; auto-delete branches
- [ ] Code security settings on (Dependabot, secret scanning, push protection, CodeQL)
- [ ] `ci.yml` (lint, typecheck, unit, build) as the required check
- [ ] `security.yml` (gitleaks, dependency audit, dependency review)
- [ ] Hardened workflow defaults (read-only token, SHA pins, persist-credentials false)
- [ ] `dependabot.yml` for npm and github-actions
- [ ] PR template, `CONTRIBUTING.md`; pre-commit hook; Node version pinned; lockfile committed
- [ ] `AGENTS.md` (short, per 10.2) and a `CLAUDE.md` containing `@AGENTS.md`
- [ ] `.claude/settings.json` with deny rules (and ask rules); `.claude/settings.local.json` and `CLAUDE.local.md` gitignored
- [ ] `.cursorignore` with secret patterns; Cursor terminal auto-run restricted; no `cat`/`head`/`sed` allowlist
- [ ] Local `.env` holds dev-only values pointing at a fake-data Neon dev branch
- [ ] Redacted planning docs copied into `docs/`; `STATUS.md` and `DECISIONS.md` created without real account names
- [ ] Vercel Authentication on for previews

**Phase 1 to 2**
- [ ] PreToolUse hooks (block edits to committed migrations; block `.env*` writes)
- [ ] Add scoped Cursor or Claude rules only for mistakes that actually repeated
- [ ] `db-tests` and `migration-drift` jobs as soon as the first migration lands
- [ ] Neon branch per PR; migration role separate from `app_user`
- [ ] Playwright job

**Phase 5 (before real data)**
- [ ] Audit `.claude/`, `.cursor/`, `AGENTS.md` and MCP config for secrets, private names and over-broad allow rules
- [ ] Confirm no production credential has ever been in a local `.env` or an agent session
- [ ] Header tests, `NEXT_PUBLIC_` secret check, full security matrix in CI
- [ ] Repo mirror or bundle backup running
- [ ] Re-scan the full history for secrets and personal data
- [ ] Private runbook verified

## Conflicts with the current plan

- **P5-08 (dependency and secret scanning) is too late.** Move it to Phase 0. It is now free, including CodeQL.
- **P0-07 and P5-13 would publish sensitive operational detail** in a public repo. Keep key locations, account names and the full runbook private; commit a redacted version.
- **P0-05 (Vercel project)** now works: personal account, Hobby, public repo. Add Vercel Authentication on previews.
- **The plan's "Rules for every agent"** exist only in prose. Copy the essentials into `AGENTS.md` (10.2) and back the critical ones with deny rules and hooks (10.3), since instructions alone are not enforced.
- **P0-07 and plan rule 4** say never store secrets in the repo. Extend that to "never in a file an agent can read" (10.5).
- **Plan rule 2 (one PR per work item)** still holds solo; the PR is your review checkpoint with 0 required approvals.

## Sources

- GitHub Docs: [Best practices for repositories](https://docs.github.com/en/enterprise-server@3.22/repositories/creating-and-managing-repositories/best-practices-for-repositories), [GitHub's plans](https://docs.github.com/en/enterprise-server@3.22/get-started/learning-about-github/githubs-plans)
- Vercel: [Hobby plan](https://vercel.com/docs/accounts/plans/hobby); [community thread on private org repos](https://community.vercel.com/t/sudden-deployment-failure-from-private-github-repository-on-hobby-plan/16314)
- Next.js: [Production checklist](https://nextjs.org/docs/app/guides/production-checklist); [OWASP Next.js cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html); [MakerKit on server actions](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions)
- GitHub Actions hardening: [BoostSecurity guide](https://boostsecurity.io/blog/how-to-secure-github-actions); [StepSecurity Secure Workflow](https://docs.stepsecurity.io/orchestrate-security/secure-workflow); [workflow hardening write-up](https://medium.com/@jordanritter/security-hardening-github-workflows-at-scale-d291a33774e1)
- Migrations: [Neon guide to automated branching](https://neon.com/guides/neon-github-actions-authomated-branching); [Clerk on Drizzle and Neon](https://clerk.com/blog/automate-neon-schema-changes-with-drizzle-and-github-actions); [MakerKit Drizzle migrations](https://makerkit.dev/docs/md/nextjs-drizzle/database/migrations)
- Cursor: [Rules](https://cursor.com/docs/context/rules), [Ignore files](https://cursor.com/docs/context/ignore-files), [forum report on agents bypassing .cursorignore](https://forum.cursor.com/t/security-privacy-issue-llms-will-attempt-to-circumvent-cursorignore/148441)
- Claude Code: [Memory and CLAUDE.md / AGENTS.md](https://code.claude.com/docs/en/memory), [Settings](https://code.claude.com/docs/en/settings), [importing AGENTS.md into CLAUDE.md](https://travis.media/blog/claude-md-import-agents-md), [settings best practices summary](https://mintlify.wiki/shanraisshan/claude-code-best-practice/best-practices/settings)
- Repo hygiene: [Ed-Fi repository scoring](https://docs.ed-fi.org/community/sdlc/continuous-integration/repository-scoring); [OpenSSF Scorecard checks overview](https://www.claudepluginhub.com/skills/sbom-tool-gh-guard/scorecard-checks)
