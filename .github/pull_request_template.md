## Work item

<!-- e.g. P3-04 — step completion server action -->

## What changed

<!-- Short description. Link STATUS.md row(s) updated. -->

## Checklist

- [ ] Work item ID is in the PR title and commit messages
- [ ] Tests added/updated and passing locally (`pnpm test`, and `pnpm test:e2e`
      if relevant)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` all pass locally
- [ ] Migration included and reviewed by hand if this PR changes the schema
      (RLS/triggers/partial indexes are hand-written, not generated)
- [ ] Role/permission checks re-verified in every new or changed server action
      and route handler (hiding a button is never the control)
- [ ] No secrets, real names, real customer/invoice data, or account
      identifiers added anywhere in this diff (code, tests, fixtures, docs)
- [ ] `STATUS.md` row(s) updated with evidence (command output, test name,
      query result, or synthetic screenshot path)

## Evidence

<!-- Paste command output / test names / screenshot paths here. -->
