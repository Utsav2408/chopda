# Database migrations

Hand-reviewed SQL migrations applied by `drizzle-orm`'s node-postgres migrator
(`pnpm db:migrate`). Layout:

- `meta/_journal.json` — ordered migration tags
- `meta/*_snapshot.json` — Drizzle schema snapshots for `pnpm db:generate` /
  migration-drift CI
- `NNNN_name.sql` — forward-only SQL (split on `--> statement-breakpoint`)

`drizzle-kit generate` writes baseline DDL from `src/server/db/schema.ts`.
Review every generated file like code. **RLS policies, triggers, DB roles,
partial indexes, and `citext` extras that the DSL cannot express are written by
hand** (see `0000_b1_schema.sql` extensions + `0001_b1_triggers_roles_rls.sql`).

## Rules

- **Forward-only.** Never edit or delete a migration that has been applied
  anywhere — write a new one to fix a mistake (`AGENTS.md`).
- **No real data.** Seeds/fixtures are synthetic only (`pnpm db:seed`).
- **Roles.** Migrations run as the owner/direct URL (`DATABASE_URL_DIRECT`).
  Runtime should eventually use limited role `app_user` via `DATABASE_URL`
  (local/CI password is synthetic `chopda_app`; on Neon, GRANT the same
  privileges to the pooled role). `app_user` cannot `UPDATE`/`DELETE`
  `audit_log`.

## Commands

```bash
pnpm db:migrate       # apply pending SQL
pnpm db:generate      # diff schema.ts → new migration (review!)
pnpm db:check-drift   # CI: generate must leave db/migrations clean
pnpm db:seed          # synthetic users + Standard/Courier flow fixtures
```
