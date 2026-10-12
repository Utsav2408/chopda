# Database migrations

Hand-reviewed SQL migrations. `drizzle-kit generate` writes files here from the
(not-yet-created) Drizzle schema; review every generated file like code,
especially anything touching RLS policies, triggers, partial indexes, or
`citext` columns — Drizzle's schema DSL cannot express those, so they are
written by hand (see `drizzle-kit generate --custom`).

Rules (see `AGENTS.md` and `docs/invoice-tracker-github-repo-checklist.md` §5):

- **Forward-only.** Drizzle has no built-in rollback. To undo a bad migration in
  a real environment, write a new migration — never edit or delete a file that
  has already been applied anywhere.
- **No real data.** Seed/fixture data referenced by a migration or its tests
  must be synthetic.
- **No production credentials here or in CI config.** Migrations run with a
  separate "owner" role; the app's runtime role (`app_user`, P1-02) never has
  schema-change privileges.

The first migration (`P1-01`: extensions, `user_role` enum, `users`, `sessions`,
`audit_log`) has not landed yet — this folder is currently a placeholder. Once it
does, Wave D's `db-tests` and `migration-drift` CI jobs turn on (see
`STATUS.md`).
