/**
 * health.check — DB, storage, used bytes, backup status, ops alerts (B7-11 / B9-08g).
 */
import { isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { documents } from "../db/schema.js";
import { STORAGE_HEALTH_CACHE_TTL_MS } from "../invoices/constants.js";
import {
  getMonthStorageOps,
  getStorageAdapter,
  storageBytesAlert,
  STORAGE_BYTES_ALERT_THRESHOLD,
  STORAGE_CLASS_A_MONTHLY_LIMIT,
  STORAGE_CLASS_B_MONTHLY_LIMIT,
  type MonthOpsTotals,
  type StorageAdapter,
  type StorageOpsAlertLevel,
} from "../storage/index.js";

export type HealthStatus = "ok" | "degraded" | "error";

export type HealthCheckResult = {
  status: HealthStatus;
  service: "chopda";
  timestamp: string;
  database: { ok: boolean; error?: string };
  storage: { ok: boolean; error?: string; cached: boolean };
  /** Active file-store adapter (`STORAGE_PROVIDER`). */
  storageProvider: string;
  storageUsedBytes: string;
  /** True when live document bytes exceed 8 GB (of 10 GB free tier). */
  storageUsedAlert: boolean;
  storageOps: {
    classAMonth: number;
    classBMonth: number;
    classALimit: number;
    classBLimit: number;
    classAAlert: StorageOpsAlertLevel;
    classBAlert: StorageOpsAlertLevel;
    storageBytesThreshold: number;
  };
  backupStatus: "none";
};

type StorageCache = { at: number; ok: boolean; error?: string };

let storageHealthCache: StorageCache | null = null;

/** Test helper. */
export function clearStorageHealthCache(): void {
  storageHealthCache = null;
}

async function probeStorage(
  storage: StorageAdapter,
  now: number,
  ttlMs: number,
): Promise<{ ok: boolean; error?: string; cached: boolean }> {
  if (storageHealthCache && now - storageHealthCache.at < ttlMs) {
    return {
      ok: storageHealthCache.ok,
      error: storageHealthCache.error,
      cached: true,
    };
  }
  try {
    await storage.healthCheck();
    storageHealthCache = { at: now, ok: true };
    return { ok: true, cached: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    storageHealthCache = { at: now, ok: false, error };
    return { ok: false, error, cached: false };
  }
}

function emptyOps(): MonthOpsTotals {
  return {
    classA: 0,
    classB: 0,
    classAAlert: "none",
    classBAlert: "none",
  };
}

/**
 * Full health check (B7-11 / B9-08g). Storage healthCheck cached ≥ 5 minutes.
 */
export async function check(opts?: {
  storage?: StorageAdapter;
  storageCacheTtlMs?: number;
  now?: Date;
  /** Inject month ops for unit tests. */
  monthOps?: MonthOpsTotals;
}): Promise<HealthCheckResult> {
  const nowDate = opts?.now ?? new Date();
  const now = nowDate.getTime();
  const ttl = opts?.storageCacheTtlMs ?? STORAGE_HEALTH_CACHE_TTL_MS;
  const storage = opts?.storage ?? getStorageAdapter();

  let database: HealthCheckResult["database"] = { ok: false };
  let storageUsedBytes = "0";
  let monthOps = opts?.monthOps ?? emptyOps();

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    database = { ok: true };

    const [sumRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${documents.sizeBytes}), 0)::text`,
      })
      .from(documents)
      .where(isNull(documents.deletedAt));
    storageUsedBytes = sumRow?.total ?? "0";

    if (!opts?.monthOps) {
      monthOps = await getMonthStorageOps(nowDate);
    }
  } catch (err) {
    database = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const storageProbe = await probeStorage(storage, now, ttl);
  const usedAlert = storageBytesAlert(storageUsedBytes);

  let status: HealthStatus = "ok";
  if (!database.ok && !storageProbe.ok) status = "error";
  else if (!database.ok || !storageProbe.ok) status = "degraded";
  else if (usedAlert || monthOps.classAAlert !== "none" || monthOps.classBAlert !== "none") {
    status = "degraded";
  }

  return {
    status,
    service: "chopda",
    timestamp: nowDate.toISOString(),
    database,
    storage: {
      ok: storageProbe.ok,
      error: storageProbe.error,
      cached: storageProbe.cached,
    },
    storageProvider: process.env.STORAGE_PROVIDER ?? "local",
    storageUsedBytes,
    storageUsedAlert: usedAlert,
    storageOps: {
      classAMonth: monthOps.classA,
      classBMonth: monthOps.classB,
      classALimit: STORAGE_CLASS_A_MONTHLY_LIMIT,
      classBLimit: STORAGE_CLASS_B_MONTHLY_LIMIT,
      classAAlert: monthOps.classAAlert,
      classBAlert: monthOps.classBAlert,
      storageBytesThreshold: STORAGE_BYTES_ALERT_THRESHOLD,
    },
    backupStatus: "none",
  };
}
