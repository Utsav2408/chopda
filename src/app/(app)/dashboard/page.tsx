import { requireCurrentUser } from "@/actions/auth";
import { healthFullCheckAction } from "@/actions/health";
import {
  dashboardByStepAction,
  dashboardCountsAction,
  dashboardNeedsAttentionAction,
  dashboardRecentActivityAction,
} from "@/actions/invoices";
import { usersListAction } from "@/actions/users";
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
  let users: Awaited<ReturnType<typeof usersListAction>> = [];
  let health: HealthUi | null = null;
  let loadError: string | null = null;

  try {
    const [c, b, n, r, u, h] = await Promise.all([
      dashboardCountsAction(),
      dashboardByStepAction(),
      dashboardNeedsAttentionAction(),
      dashboardRecentActivityAction(),
      usersListAction(),
      healthFullCheckAction().catch((): HealthUi => ({
        status: "error",
        database: { ok: false, error: "unreachable" },
        storage: { ok: false, error: "unreachable" },
        storageUsedBytes: "0",
        storageUsedAlert: false,
        backupStatus: "none",
      })),
    ]);
    counts = c as DashboardCountsUi;
    byStep = b as DashboardByStepUi[];
    needsAttention = n as NeedsAttentionUi[];
    recentActivity = r as RecentActivityUi[];
    users = u;
    health = h as HealthUi;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Request failed";
  }

  if (loadError || !counts) {
    return <ErrorState title="Could not load dashboard" message={loadError ?? "Request failed"} />;
  }

  const ownerNames = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

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
