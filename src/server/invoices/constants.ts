/**
 * Shared invoice lifecycle settings (B7).
 * Undo window and purge retention are the same number — one setting.
 */
export const UNDO_RETENTION_DAYS = 30;

/** Payment-due-soon reminder window (calendar days before due_date). */
export const DUE_SOON_DAYS = 7;

/** Dashboard counts in-memory cache TTL (30–60 s range). */
export const DASHBOARD_COUNTS_CACHE_TTL_MS = 45_000;

/** Storage healthCheck cache TTL (≥ 5 minutes; HeadBucket-style). */
export const STORAGE_HEALTH_CACHE_TTL_MS = 5 * 60_000;
