/**
 * UI-facing settings helpers (U2-05). Admin-only panels consume health + matrix.
 */
"use server";

import { requireAppUser } from "./auth";
import { check as healthCheck } from "../server/health/service.js";
import { Forbidden } from "../server/kernel/errors.js";
import type { SettingsHealth } from "../lib/settings-dto.js";

/** Full health snapshot for the Admin settings storage/backup panel. */
export async function getSettingsHealthAction(): Promise<SettingsHealth> {
  const user = await requireAppUser("/settings");
  if (user.role !== "admin") {
    throw new Forbidden();
  }
  const result = await healthCheck();
  return {
    status: result.status,
    storageProvider: result.storageProvider,
    backupStatus: result.backupStatus,
    storage: result.storage,
    database: result.database,
    storageUsedBytes: result.storageUsedBytes,
    storageUsedAlert: result.storageUsedAlert,
  };
}
