import { StatusChip } from "@/components/ui";
import type { SettingsHealth } from "@/lib/settings-dto";

type StorageBackupPanelProps = {
  health: SettingsHealth;
};

function formatBytes(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return raw;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function backupStatusLabel(status: SettingsHealth["backupStatus"]): string {
  if (status === "none") {
    return "Backups: none (gate cleared before real data — see Phase 5 / B9-07).";
  }
  return `Backups: ${status}`;
}

export function StorageBackupPanel({ health }: StorageBackupPanelProps) {
  const storageTone = health.storage.ok ? "success" : "danger";
  const dbTone = health.database.ok ? "success" : "danger";

  return (
    <section className="settings-panel" aria-labelledby="storage-backup-heading">
      <h3 id="storage-backup-heading" className="settings-panel__title">
        Storage and backup
      </h3>
      <p className="settings-panel__lede">
        Provider and reachability come from the health check. Backup status stays explicit until a
        restore path exists.
      </p>
      <dl className="settings-dl">
        <dt>Overall</dt>
        <dd>
          <StatusChip
            tone={
              health.status === "ok"
                ? "success"
                : health.status === "degraded"
                  ? "warning"
                  : "danger"
            }
          >
            {health.status}
          </StatusChip>
        </dd>
        <dt>File store provider</dt>
        <dd>
          <code>{health.storageProvider}</code>
        </dd>
        <dt>File store</dt>
        <dd>
          <StatusChip tone={storageTone}>
            {health.storage.ok ? "Reachable" : (health.storage.error ?? "Unreachable")}
          </StatusChip>
        </dd>
        <dt>Database</dt>
        <dd>
          <StatusChip tone={dbTone}>
            {health.database.ok ? "Reachable" : (health.database.error ?? "Unreachable")}
          </StatusChip>
        </dd>
        <dt>Storage used</dt>
        <dd>
          {formatBytes(health.storageUsedBytes)}
          {health.storageUsedAlert ? (
            <>
              {" "}
              <StatusChip tone="warning">Over alert threshold</StatusChip>
            </>
          ) : null}
        </dd>
        <dt>Backups</dt>
        <dd>{backupStatusLabel(health.backupStatus)}</dd>
      </dl>
    </section>
  );
}
