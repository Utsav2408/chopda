/**
 * Daily Class A / Class B operation counters for R2 free-tier budgets (B9-08g).
 * Incremented by storage adapters; surfaced on health.check.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { storageOpsDaily } from "../db/schema.js";

/** Cloudflare R2 free-tier Class A ops / month. */
export const STORAGE_CLASS_A_MONTHLY_LIMIT = 1_000_000;
/** Cloudflare R2 free-tier Class B ops / month. */
export const STORAGE_CLASS_B_MONTHLY_LIMIT = 10_000_000;
/** Alert when live document bytes exceed this (8 GB of 10 GB free). */
export const STORAGE_BYTES_ALERT_THRESHOLD = 8 * 1024 * 1024 * 1024;

export type StorageOpsDelta = {
  classA?: number;
  classB?: number;
};

export type StorageOpsAlertLevel = "none" | "warn_70" | "crit_90";

export type MonthOpsTotals = {
  classA: number;
  classB: number;
  classAAlert: StorageOpsAlertLevel;
  classBAlert: StorageOpsAlertLevel;
};

function utcDayString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function alertLevel(used: number, limit: number): StorageOpsAlertLevel {
  if (used >= limit * 0.9) return "crit_90";
  if (used >= limit * 0.7) return "warn_70";
  return "none";
}

/**
 * Increment today's Class A / Class B counters. Best-effort: failures are
 * swallowed so a counter outage never blocks put/get/delete.
 */
export async function incrementStorageOps(delta: StorageOpsDelta): Promise<void> {
  const a = Math.max(0, Math.floor(delta.classA ?? 0));
  const b = Math.max(0, Math.floor(delta.classB ?? 0));
  if (a === 0 && b === 0) return;

  try {
    const day = utcDayString();
    const db = getDb();
    await db
      .insert(storageOpsDaily)
      .values({
        day,
        classA: BigInt(a),
        classB: BigInt(b),
      })
      .onConflictDoUpdate({
        target: storageOpsDaily.day,
        set: {
          classA: sql`${storageOpsDaily.classA} + ${a}`,
          classB: sql`${storageOpsDaily.classB} + ${b}`,
        },
      });
  } catch {
    // Counter must not break storage I/O.
  }
}

/**
 * Sum Class A / B for the UTC calendar month containing `now`.
 */
export async function getMonthStorageOps(now: Date = new Date()): Promise<MonthOpsTotals> {
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;
  const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthEndExclusive = nextMonthDate.toISOString().slice(0, 10);

  try {
    const db = getDb();
    const [row] = await db
      .select({
        classA: sql<string>`coalesce(sum(${storageOpsDaily.classA}), 0)::text`,
        classB: sql<string>`coalesce(sum(${storageOpsDaily.classB}), 0)::text`,
      })
      .from(storageOpsDaily)
      .where(
        sql`${storageOpsDaily.day} >= ${monthStart}::date AND ${storageOpsDaily.day} < ${monthEndExclusive}::date`,
      );

    const classA = Number(row?.classA ?? "0");
    const classB = Number(row?.classB ?? "0");
    return {
      classA,
      classB,
      classAAlert: alertLevel(classA, STORAGE_CLASS_A_MONTHLY_LIMIT),
      classBAlert: alertLevel(classB, STORAGE_CLASS_B_MONTHLY_LIMIT),
    };
  } catch {
    return {
      classA: 0,
      classB: 0,
      classAAlert: "none",
      classBAlert: "none",
    };
  }
}

export function storageBytesAlert(usedBytes: bigint | number | string): boolean {
  const n = typeof usedBytes === "bigint" ? usedBytes : BigInt(usedBytes);
  return n > BigInt(STORAGE_BYTES_ALERT_THRESHOLD);
}
