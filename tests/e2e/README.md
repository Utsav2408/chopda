# End-to-end tests (U5-03 / U5-04)

Playwright specs live in this folder. Default CI runs whatever the e2e job
enables; seeded lifecycle coverage is **opt-in**.

## Phone-width smoke (U5-03)

```bash
pnpm build && pnpm start   # or pnpm dev on another terminal
pnpm test:e2e tests/e2e/phone-width.spec.ts
```

Asserts `document.documentElement.scrollWidth <= window.innerWidth` at
**390×844** for `/login`, `/dashboard`, `/invoices`, and `/flows`.
Unauthenticated visits to app routes may redirect to login; the final page
must still not overflow.

## Invoice lifecycle skeleton (U5-04)

Skipped unless `E2E_SEEDED=1`. Structure:

1. **Admin** signs in → creates an invoice on `/invoices/new`
2. **Builder** signs in → opens the invoice, optionally uploads a file, completes the current step
3. **Viewer** signs in → can view the invoice; no complete/create affordance; create API denied

### Prep (local / private CI)

1. Apply migrations and seed:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

2. Seed users (`scripts/seed.ts`) start with `must_change_password = true`.
   For E2E, clear that flag (and optionally set known passwords) on a **dev**
   database only:

   ```sql
   UPDATE users
   SET must_change_password = false
   WHERE username IN ('admin', 'builder1', 'viewer1');
   ```

   Default seed password for all seeded users: `ChangeMe!dev-only`
   (dev/test only — never production).

3. Run the app with the same `DATABASE_URL` / env as the seed, then:

   ```bash
   E2E_SEEDED=1 pnpm test:e2e tests/e2e/invoice-lifecycle.spec.ts
   ```

Optional overrides: `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD`,
`E2E_BUILDER_USER`, `E2E_BUILDER_PASSWORD`, `E2E_VIEWER_USER`,
`E2E_VIEWER_PASSWORD`, `PLAYWRIGHT_BASE_URL`.

Without `E2E_SEEDED=1`, the lifecycle test is skipped so CI stays green
without a seeded auth database.
