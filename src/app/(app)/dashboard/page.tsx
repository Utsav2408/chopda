import { requireCurrentUser } from "@/actions/auth";
import { healthFullCheckAction } from "@/actions/health";
import { dashboardLoadAction } from "@/actions/invoices";
import {
  DashboardView,
  type DashboardByStepUi,
  type DashboardCountsUi,
  type HealthUi,
  type NeedsAttentionUi,
  type RecentActivityUi,
} from "@/components/dashboard/DashboardView";
import { ErrorState } from "@/components/ui";

export default async function DashboardPage() {
  await requireCurrentUser("/dashboard");

  let counts: DashboardCountsUi | null = null;
  let byStep: DashboardByStepUi[] = [];
  let needsAttention: NeedsAttentionUi[] = [];
  let recentActivity: RecentActivityUi[] = [];
  let ownerNames: Record<string, string> = {};
  let health: HealthUi | null = null;
  let loadError: string | null = null;

  try {
    const [bundle, h] = await Promise.all([
      dashboardLoadAction(),
      healthFullCheckAction().catch((): HealthUi => ({
        status: "error",
        database: { ok: false, error: "unreachable" },
        storage: { ok: false, error: "unreachable" },
        storageUsedBytes: "0",
        storageUsedAlert: false,
        backupStatus: "none",
      })),
    ]);
    counts = bundle.counts as DashboardCountsUi;
    byStep = bundle.byStep as DashboardByStepUi[];
    needsAttention = bundle.needsAttention as NeedsAttentionUi[];
    recentActivity = bundle.recentActivity as RecentActivityUi[];
    ownerNames = bundle.ownerNames;
    health = h as HealthUi;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Request failed";
  }

  if (loadError || !counts) {
    return <ErrorState title="Could not load dashboard" message={loadError ?? "Request failed"} />;
  }

  return (
    <DashboardView
      counts={counts}
      byStep={byStep}
      needsAttention={needsAttention}
      recentActivity={recentActivity}
      health={health}
      ownerNames={ownerNames}
    />
  );
}
