import Link from "next/link";
import { EmptyState, StatusChip, Table, type TableColumn } from "@/components/ui";
import { formatDate, statusTone } from "@/lib/invoice-ui";
import "@/components/invoices/invoices.css";

export type DashboardCountsUi = {
  open: number;
  waiting: number;
  overdue: number;
  completed: number;
};

export type DashboardByStepUi = {
  flowStepId: string;
  stepName: string;
  stepNumber: number;
  flowTemplateId: string;
  count: number;
};

export type NeedsAttentionUi = {
  id: string;
  invoiceNo: string;
  partyName: string;
  status: "waiting" | "overdue";
  dueDate: string | null;
  ownerId: string;
};

export type RecentActivityUi = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  at: string | Date;
};

export type HealthUi = {
  status: "ok" | "degraded" | "error";
  database: { ok: boolean; error?: string };
  storage: { ok: boolean; error?: string; cached?: boolean };
  storageUsedBytes: string;
  storageUsedAlert: boolean;
  backupStatus: string;
};

export type DashboardViewProps = {
  counts: DashboardCountsUi;
  byStep: DashboardByStepUi[];
  needsAttention: NeedsAttentionUi[];
  recentActivity: RecentActivityUi[];
  health: HealthUi | null;
  ownerNames: Record<string, string>;
};

export function DashboardView({
  counts,
  byStep,
  needsAttention,
  recentActivity,
  health,
  ownerNames,
}: DashboardViewProps) {
  const attentionColumns: TableColumn<NeedsAttentionUi>[] = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (row) => (
        <Link href={`/invoices/${row.id}`}>
          <strong>{row.invoiceNo}</strong>
          <div className="ui-hint">{row.partyName}</div>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusChip tone={statusTone(row.status)}>{row.status}</StatusChip>,
    },
    {
      key: "due",
      header: "Due",
      cell: (row) => row.dueDate ?? "—",
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row) => ownerNames[row.ownerId] ?? row.ownerId.slice(0, 8),
    },
  ];

  const stepColumns: TableColumn<DashboardByStepUi>[] = [
    {
      key: "step",
      header: "Step",
      cell: (row) => `${row.stepNumber}. ${row.stepName}`,
    },
    {
      key: "count",
      header: "Open invoices",
      cell: (row) => String(row.count),
    },
  ];

  return (
    <div className="inv-stack">
      <div className="inv-page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="ui-hint" style={{ margin: 0 }}>
            Counts refresh about every 45 seconds.
          </p>
        </div>
        <div className="inv-page-header__actions">
          <Link className="ui-btn ui-btn--ghost" href="/invoices">
            All invoices
          </Link>
        </div>
      </div>

      <div className="dash-counts">
        {(
          [
            ["open", counts.open],
            ["waiting", counts.waiting],
            ["overdue", counts.overdue],
            ["completed", counts.completed],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="dash-count">
            <div className="dash-count__value">{value}</div>
            <div className="dash-count__label">{label}</div>
          </div>
        ))}
      </div>

      <div className="inv-grid-2">
        <section className="inv-panel">
          <h3>Needs attention</h3>
          <Table
            columns={attentionColumns}
            rows={needsAttention}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                title="Nothing needs attention"
                description="Waiting and overdue invoices will appear here."
              />
            }
          />
        </section>

        <section className="inv-panel">
          <h3>By current step</h3>
          <Table
            columns={stepColumns}
            rows={byStep}
            rowKey={(r) => r.flowStepId}
            empty={
              <EmptyState title="No open steps" description="Start an invoice to see counts." />
            }
          />
        </section>
      </div>

      <div className="inv-grid-2">
        <section className="inv-panel">
          <h3>Recent activity</h3>
          {recentActivity.length === 0 ? (
            <EmptyState title="No recent activity" />
          ) : (
            <ul className="inv-history-list">
              {recentActivity.map((item) => (
                <li key={item.id} className="inv-history-item">
                  <div>
                    {item.action}
                    {item.entityId ? (
                      <>
                        {" · "}
                        {item.entity === "invoice" ? (
                          <Link href={`/invoices/${item.entityId}`}>
                            {item.entityId.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span>{item.entity}</span>
                        )}
                      </>
                    ) : null}
                  </div>
                  <div className="inv-history-meta">
                    {item.actorId
                      ? (ownerNames[item.actorId] ?? item.actorId.slice(0, 8))
                      : "System"}{" "}
                    · {formatDate(item.at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="inv-panel dash-health"
          data-status={health?.status ?? "error"}
          aria-labelledby="dash-health-heading"
        >
          <h3 id="dash-health-heading">System health</h3>
          {!health ? (
            <p className="ui-field-error">Could not load health (?full=1).</p>
          ) : (
            <ul className="inv-meta-list">
              <li>
                <span className="inv-meta-label">Status</span>
                <span>
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
                </span>
              </li>
              <li>
                <span className="inv-meta-label">Database</span>
                <span>{health.database.ok ? "ok" : (health.database.error ?? "error")}</span>
              </li>
              <li>
                <span className="inv-meta-label">Storage</span>
                <span>{health.storage.ok ? "ok" : (health.storage.error ?? "error")}</span>
              </li>
              <li>
                <span className="inv-meta-label">Used</span>
                <span>
                  {health.storageUsedBytes} bytes
                  {health.storageUsedAlert ? " · alert" : ""}
                </span>
              </li>
              <li>
                <span className="inv-meta-label">Backups</span>
                <span>{health.backupStatus === "none" ? "none" : health.backupStatus}</span>
              </li>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
