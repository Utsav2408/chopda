# Contributing

Solo project today (see `DECISIONS.md`, D3), but these working agreements keep
history and PRs easy to review — by the owner now, by anyone else later.

## Branches and PRs

- One work item per branch and PR. Branch names follow the work item ID, e.g.
  `p3-04-step-completion` for work item `P3-04`.
- Commit and PR titles start with the work item ID (`P1-06: sign-in screen`).
  Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) are optional but help
  scanning the history.
- Keep PRs small enough to review in about 15 minutes. Put migrations in their
  own PR where possible.
- Squash merge only; the PR title becomes the commit message. Head branches are
  auto-deleted after merge.
- No required approvals (solo, 0 reviewers) — the ruleset still requires a PR
  and a green `ci.yml` run before merge. Read your own diff and the CI output
  before merging, especially for agent-written code.

## Done means evidence exists

A work item is "done" only when:

- Its row in `STATUS.md` is evidence (a command output, test name, query
  result, or synthetic screenshot) is pasted, not just marked.
- Tests for it pass in CI.
- No real customer data, invoice contents, credentials, or account identifiers
  were used anywhere in the change (fixtures and screenshots are synthetic).

## Releases

- Tag releases `release-1`, `release-2`, etc., with short release notes. Tag
  before any go-live step so there is a point to come back to.
- No Phase 6 (agentic layer) code merges to `main` before its gates are met
  (see `STATUS.md` Phase 6 section and plan rule 8).

## Before opening a PR

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Paste the output (or a summary) into the PR per the template, and into the
relevant `STATUS.md` row.

## Secrets and data

- Never commit `.env`, real credentials, real customer/invoice data, or
  anything the `.gitignore` excludes.
- If you think you may have committed a secret, **do not just delete it in a
  new commit** — rotate it, then ask about scrubbing history. A public repo
  means it may already be scraped.
