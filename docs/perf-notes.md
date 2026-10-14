# Performance notes (B9-03)

Methodology and placeholder results for the Release-1 backend load target:
**5,000 invoices**, **20 concurrent users** on list / dashboard / step completion,
**p95 under 1 s**.

## How to run

### Synthetic (no database)

Times the pure keyset list helper over N in-memory rows. Useful for CI smoke and
algorithm regressions — **not** a DB benchmark.

```bash
pnpm exec tsx scripts/perf-smoke.ts
PERF_INVOICE_COUNT=5000 pnpm exec tsx scripts/perf-smoke.ts
```

### Live DB (owner / local)

1. Migrate and seed a throwaway database with ~5,000 synthetic invoices
   (extend `scripts/seed.ts` or insert via SQL — never use real customer data).
2. Point env at that DB and run:

```bash
PERF_LIVE=1 PERF_USER_ID=<admin-uuid> pnpm exec tsx scripts/perf-smoke.ts
```

3. Optionally hammer list / dashboard / step-complete with 20 concurrent clients
   (k6, autocannon, or a short script). Record p50 / p95 / p99 below.

## Indexes in play

See B7-02 evidence in `STATUS.md`:

| Query intent        | Index                         |
| ------------------- | ----------------------------- |
| List keyset         | `invoices_created_at_id_idx`  |
| Owner / flow / step | B1 indexes on those columns   |
| Date range          | `invoices_issue_date_idx`     |
| History             | `audit_log_entity_id_at_idx`  |

## Results (placeholder — run against seeded DB)

| Scenario                         | n / concurrency | p50 | p95 | p99 | Notes                          |
| -------------------------------- | --------------- | --- | --- | --- | ------------------------------ |
| Synthetic list (in-memory)       | 5k / 1          | —   | —   | —   | Paste `perf-smoke` JSON        |
| Live `invoices.list` page 1      | 5k / 1          | —   | —   | —   | `PERF_LIVE=1`                  |
| Live list                        | 5k / 20         | —   | —   | —   | Target p95 &lt; 1s             |
| Dashboard counts                 | 5k / 20         | —   | —   | —   | Cached ~45s (`B7-03`)          |
| Step complete                    | 5k / 20         | —   | —   | —   | Single-row update + trigger    |

**Status:** methodology and harness committed (B9-03). Real 5k numbers require a
seeded database — leave cells blank until an owner/local run fills them.
