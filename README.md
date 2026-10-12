# Chopda (चोपड़ा)

Chopda is a private invoice tracker where teams build their own step-by-step flows
and track every invoice and its documents through them. Built with Next.js
(App Router, TypeScript) and PostgreSQL (Neon).

> **No real data in dev.** Local development and CI use seeded, synthetic data only.
> Never point a local `.env` at a production database or copy real invoices,
> company details, or customer data into this repo, a fixture, or a chat with an
> AI agent.

## Status and decisions

- [`STATUS.md`](STATUS.md) — one row per work item from the implementation plan.
- [`DECISIONS.md`](DECISIONS.md) — owner decisions (D1–D5, Phase 0 answers).
- [`docs/`](docs/) — the planning docs this project is built from (idea/problem,
  wireframes, database & security architecture, agentic UI, phasewise plan, this
  repo's GitHub checklist).
- [`AGENTS.md`](AGENTS.md) — rules for any AI coding agent working in this repo.

## Requirements

- Node.js (see [`.nvmrc`](.nvmrc) — currently Node 24.x, the current LTS line).
- [pnpm](https://pnpm.io/) as the package manager (see `packageManager` in
  [`package.json`](package.json)).
- A PostgreSQL database for local dev (a [Neon](https://neon.tech) **dev** branch
  seeded with fake data is recommended; a local Postgres also works).

## Setup

```bash
corepack enable          # or: npm install -g pnpm
pnpm install
cp .env.example .env     # fill in local, dev-only values — never real secrets
```

See [`.env.example`](.env.example) for every variable and what it protects. Nothing
in `.env` is ever committed; the file is gitignored.

## Run

```bash
pnpm dev        # start the Next.js dev server
```

## Test

```bash
pnpm lint        # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright (requires `pnpm build && pnpm start` or dev server running)
```

## Migrate

```bash
pnpm db:generate   # drizzle-kit generate — create a new migration from schema changes
pnpm db:migrate    # drizzle-kit migrate — apply pending migrations
```

Migrations are forward-only (Drizzle has no built-in rollback). Review every
generated SQL file like code before committing it — hand-written SQL for RLS
policies, triggers, and partial indexes lives alongside the generated files in
[`db/migrations/`](db/migrations/).

## Build and deploy

```bash
pnpm build
pnpm start
```

Deploys run on [Vercel](https://vercel.com) (Hobby plan) from this repository.
Preview deployments are behind Vercel Authentication. Production environment
variables are set in Vercel only — never in this repo.

## Environment variables

See [`.env.example`](.env.example) for the full list and inline notes on which
values are server-only. Summary:

| Variable              | Purpose                                                  | Server-only |
| --------------------- | -------------------------------------------------------- | ----------- |
| `DATABASE_URL`        | Pooled Postgres connection string used by the app        | Yes         |
| `DATABASE_URL_DIRECT` | Direct connection string, migrations only                | Yes         |
| `SESSION_SECRET`      | Signs/derives session tokens                             | Yes         |
| `ENCRYPTION_KEY`      | AES-256-GCM key for field-level encryption               | Yes         |
| `STORAGE_PROVIDER`    | `local` during build; a reliable provider before go-live | Yes         |
| `FILE_STORAGE_DIR`    | Local storage folder (dev/test only)                     | Yes         |
| `CRON_SECRET`         | Shared secret for scheduled job routes                   | Yes         |

No variable in this project should ever be prefixed `NEXT_PUBLIC_` if its name
contains `SECRET`, `KEY`, `TOKEN`, or `PASSWORD` — `security.yml` checks this in CI.

## Project layout

```
src/app/(auth)/     unauthenticated routes (sign-in)
src/app/(app)/      authenticated routes
src/server/         server-only data access layer (DAL), never imported by client code
src/server/storage/ storage adapter (local folder today; swappable later)
db/migrations/      hand-reviewed SQL migrations (generated + custom)
scripts/            one-off and operational scripts (bootstrap, smoke tests)
tests/              Vitest unit tests and Playwright e2e tests
docs/               planning docs and this repo's agent/security checklist
```

## License

No open-source license is granted at this time. All rights reserved — code is
visible for transparency, but is not licensed for reuse. See
[`DECISIONS.md`](DECISIONS.md) (D4).

## Security

See [`SECURITY.md`](SECURITY.md) to report a vulnerability. Do not use public
issues for security reports.
