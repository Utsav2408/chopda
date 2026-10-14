#!/usr/bin/env tsx
/**
 * B9-03: Lightweight perf smoke for invoices.list.
 *
 * Modes:
 *   1. Synthetic (default, no DB): times an in-memory keyset list of N rows.
 *   2. Live DB: set PERF_LIVE=1 (+ DATABASE_URL) to time a real invoices.list
 *      against a seeded database (see docs/perf-notes.md).
 *
 * Usage:
 *   pnpm exec tsx scripts/perf-smoke.ts
 *   PERF_INVOICE_COUNT=5000 pnpm exec tsx scripts/perf-smoke.ts
 *   PERF_LIVE=1 pnpm exec tsx scripts/perf-smoke.ts   # requires DB + seed
 */
import { performance } from "node:perf_hooks";
import {
  applyListQuery,
  encodeListCursor,
  type ListCandidate,
} from "../src/server/invoices/list-logic.js";

const COUNT = Number(process.env.PERF_INVOICE_COUNT ?? "5000");
const LIVE = process.env.PERF_LIVE === "1" || process.env.PERF_LIVE === "true";
const VIEWER = "00000000-0000-4000-8000-000000000001";

function syntheticCandidates(n: number): ListCandidate[] {
  const rows: ListCandidate[] = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < n; i++) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    rows.push({
      id,
      invoiceNo: `INV-${String(i).padStart(5, "0")}`,
      partyName: `Party ${i % 200}`,
      ownerId: VIEWER,
      flowTemplateId: "00000000-0000-4000-8000-0000000000f1",
      currentStepId: null,
      issueDate: new Date(base + (i % 365) * 86_400_000).toISOString().slice(0, 10),
      dueDate: null,
      createdAt: new Date(base + i * 1000),
      status: i % 17 === 0 ? "completed" : "open",
      deletedAt: null,
    });
  }
  return rows;
}

function runSynthetic(): void {
  console.log(`[perf-smoke] Synthetic in-memory list of ${COUNT} invoices`);
  const all = syntheticCandidates(COUNT);
  const t0 = performance.now();
  const page1 = applyListQuery(
    all,
    {
      tab: "all",
      sort: "createdAt",
      sortDir: "desc",
      limit: 50,
    },
    VIEWER,
  );
  const t1 = performance.now();
  const last = page1.items[page1.items.length - 1];
  const cursor =
    page1.nextCursor ??
    (last ? encodeListCursor({ id: last.id, sortValue: last.createdAt.toISOString() }) : undefined);
  const page2 = applyListQuery(
    all,
    {
      tab: "all",
      sort: "createdAt",
      sortDir: "desc",
      limit: 50,
      cursor,
    },
    VIEWER,
  );
  const t2 = performance.now();

  console.log(
    JSON.stringify(
      {
        mode: "synthetic",
        invoiceCount: COUNT,
        page1Ms: Number((t1 - t0).toFixed(2)),
        page2Ms: Number((t2 - t1).toFixed(2)),
        page1Count: page1.items.length,
        page2Count: page2.items.length,
        note: "Not a DB benchmark — see docs/perf-notes.md for live 5k methodology",
      },
      null,
      2,
    ),
  );
}

async function runLive(): Promise<void> {
  const url =
    process.env.PERF_DATABASE_URL ?? process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    console.log("[perf-smoke] PERF_LIVE=1 but no DATABASE_URL — skipping live timing");
    console.log(
      "[perf-smoke] Seed ~5k invoices then re-run; paste timings into docs/perf-notes.md",
    );
    return;
  }

  process.env.DATABASE_URL ??= url;
  process.env.DATABASE_URL_DIRECT ??= url;
  process.env.SESSION_SECRET ??= "perf-session-secret-32-characters!!";
  process.env.ENCRYPTION_KEY ??= "perf-encryption-key-32-characters!!";
  process.env.STORAGE_PROVIDER ??= "local";
  process.env.FILE_STORAGE_DIR ??= "/tmp/chopda-perf-storage";
  process.env.CRON_SECRET ??= "perf-cron-secret";

  const { resetEnvCache } = await import("../src/server/env.js");
  resetEnvCache();
  const { resetDbClient } = await import("../src/server/db/client.js");
  await resetDbClient();

  const { list } = await import("../src/server/invoices/list.js");
  const ctx = {
    userId: process.env.PERF_USER_ID ?? VIEWER,
    role: "admin" as const,
    requestId: "perf-smoke",
  };

  const t0 = performance.now();
  try {
    const page = await list(ctx, { tab: "all", sort: "createdAt", sortDir: "desc", limit: 50 });
    const t1 = performance.now();
    console.log(
      JSON.stringify(
        {
          mode: "live",
          page1Ms: Number((t1 - t0).toFixed(2)),
          page1Count: page.items.length,
          hasMore: Boolean(page.nextCursor),
          note: "Paste into docs/perf-notes.md; target p95 < 1s under 20 concurrent users",
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error("[perf-smoke] live list failed:", err instanceof Error ? err.message : err);
    console.error(
      "[perf-smoke] Ensure DB is migrated + seeded; set PERF_USER_ID to a real admin id",
    );
    process.exitCode = 1;
  } finally {
    await resetDbClient();
  }
}

async function main() {
  if (LIVE) {
    await runLive();
  } else {
    runSynthetic();
  }
}

main().catch((err) => {
  console.error("[perf-smoke] FAILED:", err);
  process.exit(1);
});
