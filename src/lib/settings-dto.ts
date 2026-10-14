/** Health slice for Admin settings storage/backup panel (U2-05). */

export type SettingsHealth = {
  status: "ok" | "degraded" | "error";
  storageProvider: string;
  backupStatus: "none" | string;
  storage: { ok: boolean; error?: string; cached: boolean };
  database: { ok: boolean; error?: string };
  storageUsedBytes: string;
  storageUsedAlert: boolean;
};
