/**
 * health.check — DB, storage, used bytes, backup status (B7-11).
 * Class A/B ops alerts land with B9-08g.
 */
import { isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { documents } from "../db/schema.js";
import { STORAGE_HEALTH_CACHE_TTL_MS } from "../invoices/constants.js";
import { getStorageAdapter, type StorageAdapter } from "../storage/index.js";

/** Soft alert when live document bytes exceed 8 GB (of 10 GB free-tier headroom). */
export const STORAGE_BYTES_ALERT_THRESHOLD = 8 * 1024 * 1024 * 1024;

export function storageBytesAlert(usedBytes: string | number | bigint): boolean {
  const n = typeof usedBytes === "bigint" ? usedBytes : BigInt(String(usedBytes));
  return n > BigInt(STORAGE_BYTES_ALERT_THRESHOLD);
}

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

/**
 * Full health check (B7-11). Storage healthCheck cached ≥ 5 minutes.
 */
export async function check(opts?: {
  storage?: StorageAdapter;
  storageCacheTtlMs?: number;
  now?: Date;
}): Promise<HealthCheckResult> {
  const nowDate = opts?.now ?? new Date();
  const now = nowDate.getTime();
  const ttl = opts?.storageCacheTtlMs ?? STORAGE_HEALTH_CACHE_TTL_MS;
  const storage = opts?.storage ?? getStorageAdapter();

  let database: HealthCheckResult["database"] = { ok: false };
  let storageUsedBytes = "0";

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
  else if (usedAlert) status = "degraded";

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
    backupStatus: "none",
  };
}
