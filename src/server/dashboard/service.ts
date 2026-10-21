/**
 * Dashboard aggregates (B7-03, B7-04).
 */
import { desc, eq, inArray, isNull } from "drizzle-orm";
import type { AuthContext } from "../authz/index.js";
import type { AppTx } from "../db/client.js";
import { auditLog, flowSteps, flowVersions, invoices, invoiceSteps, users } from "../db/schema.js";
import { withUser } from "../db/with-user.js";
import { DASHBOARD_COUNTS_CACHE_TTL_MS } from "../invoices/constants.js";
import { assertCanReadInvoices } from "../invoices/service.js";
import {
  DEFAULT_WAITING_DAYS,
  deriveInvoiceStatus,
  type DerivedInvoiceStatus,
} from "../invoices/status.js";

export type DashboardCounts = {
  open: number;
  waiting: number;
  overdue: number;
  completed: number;
};

export type DashboardByStepRow = {
  flowStepId: string;
  stepName: string;
  stepNumber: number;
  flowTemplateId: string;
  count: number;
};

export type NeedsAttentionItem = {
  id: string;
  invoiceNo: string;
  partyName: string;
  status: "waiting" | "overdue";
  dueDate: string | null;
  ownerId: string;
};

export type RecentActivityItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  at: Date;
};

export type DashboardBundle = {
  counts: DashboardCounts;
  byStep: DashboardByStepRow[];
  needsAttention: NeedsAttentionItem[];
  recentActivity: RecentActivityItem[];
  ownerNames: Record<string, string>;
};

type CacheEntry = { at: number; value: DashboardCounts; userId: string };

const countsCache = new Map<string, CacheEntry>();

export type DerivedInvoiceRow = {
  id: string;
  invoiceNo: string;
  partyName: string;
  ownerId: string;
  dueDate: string | null;
  currentStepId: string | null;
  currentStepOpenedAt: Date | null;
  storedStatus: string;
  status: DerivedInvoiceStatus;
};

/**
 * Load live invoices + steps and derive status (shared with reminders).
 * Scoped to non-deleted invoices; step query filtered by those invoice IDs.
 */
export async function loadDerivedStatuses(
  tx: AppTx,
  now: Date,
  opts?: { waitingDays?: number },
): Promise<DerivedInvoiceRow[]> {
  const waitingDays = opts?.waitingDays ?? DEFAULT_WAITING_DAYS;
  const rows = await tx
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      partyName: invoices.partyName,
      ownerId: invoices.ownerId,
      dueDate: invoices.dueDate,
      currentStepId: invoices.currentStepId,
      storedStatus: invoices.status,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(isNull(invoices.deletedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const stepRows = await tx
    .select({
      invoiceId: invoiceSteps.invoiceId,
      flowStepId: invoiceSteps.flowStepId,
      position: flowSteps.position,
      status: invoiceSteps.status,
      completedAt: invoiceSteps.completedAt,
    })
    .from(invoiceSteps)
    .innerJoin(flowSteps, eq(invoiceSteps.flowStepId, flowSteps.id))
    .where(inArray(invoiceSteps.invoiceId, ids));

  const stepsByInvoice = new Map<string, typeof stepRows>();
  for (const s of stepRows) {
    const list = stepsByInvoice.get(s.invoiceId) ?? [];
    list.push(s);
    stepsByInvoice.set(s.invoiceId, list);
  }

  return rows.map((r) => {
    const steps = stepsByInvoice.get(r.id) ?? [];
    let openedAt: Date | null = r.createdAt;
    if (r.currentStepId) {
      const current = steps.find((s) => s.flowStepId === r.currentStepId);
      if (current) {
        const prev = steps
          .filter((s) => s.position < current.position && s.status === "completed" && s.completedAt)
          .sort((a, b) => b.position - a.position)[0];
        openedAt = prev?.completedAt ?? r.createdAt;
      }
    }
    const status = deriveInvoiceStatus({
      status: r.storedStatus,
      dueDate: r.dueDate,
      currentStepOpenedAt: openedAt,
      waitingDays,
      now,
    });
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      partyName: r.partyName,
      ownerId: r.ownerId,
      dueDate: r.dueDate,
      currentStepId: r.currentStepId,
      currentStepOpenedAt: openedAt,
      storedStatus: r.storedStatus,
      status,
    };
  });
}

function aggregateCounts(derived: DerivedInvoiceRow[]): DashboardCounts {
  const out: DashboardCounts = { open: 0, waiting: 0, overdue: 0, completed: 0 };
  for (const row of derived) {
    if (row.status === "open") out.open += 1;
    else if (row.status === "waiting") out.waiting += 1;
    else if (row.status === "overdue") out.overdue += 1;
    else if (row.status === "completed") out.completed += 1;
  }
  return out;
}

async function aggregateByStep(
  tx: AppTx,
  derived: DerivedInvoiceRow[],
): Promise<DashboardByStepRow[]> {
  const openish = derived.filter(
    (d) => d.status === "open" || d.status === "waiting" || d.status === "overdue",
  );
  const stepIds = [
    ...new Set(openish.map((d) => d.currentStepId).filter((id): id is string => id !== null)),
  ];
  if (stepIds.length === 0) return [];

  const stepMeta = await tx
    .select({
      id: flowSteps.id,
      name: flowSteps.name,
      position: flowSteps.position,
      templateId: flowVersions.templateId,
    })
    .from(flowSteps)
    .innerJoin(flowVersions, eq(flowSteps.versionId, flowVersions.id))
    .where(inArray(flowSteps.id, stepIds));

  const metaById = new Map(stepMeta.map((s) => [s.id, s]));
  const countsByStep = new Map<string, number>();
  for (const d of openish) {
    if (!d.currentStepId) continue;
    countsByStep.set(d.currentStepId, (countsByStep.get(d.currentStepId) ?? 0) + 1);
  }

  return [...countsByStep.entries()]
    .map(([flowStepId, count]) => {
      const meta = metaById.get(flowStepId);
      return {
        flowStepId,
        stepName: meta?.name ?? "Unknown",
        stepNumber: meta ? meta.position + 1 : 0,
        flowTemplateId: meta?.templateId ?? "",
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.stepNumber - b.stepNumber);
}

function aggregateNeedsAttention(
  derived: DerivedInvoiceRow[],
  limit: number,
): NeedsAttentionItem[] {
  return derived
    .filter((d): d is typeof d & { status: "waiting" | "overdue" } => {
      return d.status === "waiting" || d.status === "overdue";
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "overdue" ? -1 : 1;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    })
    .slice(0, limit)
    .map((d) => ({
      id: d.id,
      invoiceNo: d.invoiceNo,
      partyName: d.partyName,
      status: d.status,
      dueDate: d.dueDate,
      ownerId: d.ownerId,
    }));
}

async function loadRecentActivity(tx: AppTx, limit: number): Promise<RecentActivityItem[]> {
  const rows = await tx
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      actorId: auditLog.actorId,
      at: auditLog.at,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.at))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    actorId: r.actorId,
    at: r.at,
  }));
}

async function loadDisplayNames(tx: AppTx, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const rows = await tx
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, unique));
  return Object.fromEntries(rows.map((r) => [r.id, r.displayName]));
}

/**
 * Single-txn dashboard load: one derived-status scan + activity + slim name map.
 */
export async function loadDashboard(
  ctx: AuthContext,
  opts?: { now?: Date; attentionLimit?: number; activityLimit?: number },
): Promise<DashboardBundle> {
  const authed = assertCanReadInvoices(ctx);
  const now = opts?.now ?? new Date();
  const attentionLimit = opts?.attentionLimit ?? 20;
  const activityLimit = opts?.activityLimit ?? 5;

  return withUser(authed, async (tx) => {
    const derived = await loadDerivedStatuses(tx, now);
    const countsValue = aggregateCounts(derived);
    countsCache.set(authed.userId, {
      at: now.getTime(),
      value: countsValue,
      userId: authed.userId,
    });

    const byStepRows = await aggregateByStep(tx, derived);
    const attention = aggregateNeedsAttention(derived, attentionLimit);
    const activity = await loadRecentActivity(tx, activityLimit);
    const nameIds = [
      ...attention.map((a) => a.ownerId),
      ...activity.map((a) => a.actorId).filter((id): id is string => id !== null),
    ];
    const ownerNames = await loadDisplayNames(tx, nameIds);

    return {
      counts: countsValue,
      byStep: byStepRows,
      needsAttention: attention,
      recentActivity: activity,
      ownerNames,
    };
  });
}

/**
 * Counts of open / waiting / overdue / completed with a short in-memory cache (B7-03).
 */
export async function counts(
  ctx: AuthContext,
  opts?: { now?: Date; cacheTtlMs?: number; bypassCache?: boolean },
): Promise<DashboardCounts> {
  const authed = assertCanReadInvoices(ctx);
  const now = opts?.now ?? new Date();
  const ttl = opts?.cacheTtlMs ?? DASHBOARD_COUNTS_CACHE_TTL_MS;
  const cacheKey = authed.userId;

  if (!opts?.bypassCache) {
    const hit = countsCache.get(cacheKey);
    if (hit && hit.userId === authed.userId && now.getTime() - hit.at < ttl) {
      return hit.value;
    }
  }

  const value = await withUser(authed, async (tx) => {
    const derived = await loadDerivedStatuses(tx, now);
    return aggregateCounts(derived);
  });

  countsCache.set(cacheKey, { at: now.getTime(), value, userId: authed.userId });
  return value;
}

/**
 * Open invoices grouped by current flow step (B7-04).
 */
export async function byStep(
  ctx: AuthContext,
  opts?: { now?: Date },
): Promise<DashboardByStepRow[]> {
  const authed = assertCanReadInvoices(ctx);
  const now = opts?.now ?? new Date();

  return withUser(authed, async (tx) => {
    const derived = await loadDerivedStatuses(tx, now);
    return aggregateByStep(tx, derived);
  });
}

/**
 * Waiting + overdue invoices (needs attention) (B7-04).
 */
export async function needsAttention(
  ctx: AuthContext,
  opts?: { now?: Date; limit?: number },
): Promise<NeedsAttentionItem[]> {
  const authed = assertCanReadInvoices(ctx);
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 20;

  return withUser(authed, async (tx) => {
    const derived = await loadDerivedStatuses(tx, now);
    return aggregateNeedsAttention(derived, limit);
  });
}

/**
 * Recent audit activity visible to the caller (B7-04).
 * Role-filtered via RLS (invoice-tied rows for non-admin after B7 migration).
 */
export async function recentActivity(
  ctx: AuthContext,
  opts?: { limit?: number },
): Promise<RecentActivityItem[]> {
  const authed = assertCanReadInvoices(ctx);
  const limit = opts?.limit ?? 5;

  return withUser(authed, async (tx) => loadRecentActivity(tx, limit));
}
