/**
 * invoices.list — tabs, filters, sort, keyset pagination (B7-01).
 */
import { eq, inArray, isNull, sql } from "drizzle-orm";
import type { AuthContext } from "../authz/index.js";
import type { AppTx } from "../db/client.js";
import { flowSteps, flowVersions, invoices, invoiceSteps } from "../db/schema.js";
import { withUser } from "../db/with-user.js";
import { paiseToRupees } from "../money/money.js";
import { assertCanReadInvoices } from "./service.js";
import { applyListQuery, type ListCandidate, type ListQuery } from "./list-logic.js";
import type { ListInvoicesQuery } from "./schema.js";
import { DEFAULT_WAITING_DAYS, deriveInvoiceStatus } from "./status.js";

export type InvoiceListItem = {
  id: string;
  invoiceNo: string;
  partyName: string;
  amountRupees: string;
  currency: string;
  status: ListCandidate["status"];
  ownerId: string;
  flowTemplateId: string;
  flowVersionId: string;
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepNumber: number | null;
  issueDate: string;
  dueDate: string | null;
  createdAt: Date;
  /** Completed steps / total steps. */
  progress: { completed: number; total: number };
};

export type InvoiceListResult = {
  items: InvoiceListItem[];
  nextCursor: string | null;
};

type LoadedRow = {
  id: string;
  invoiceNo: string;
  partyName: string;
  amountMinor: bigint;
  currency: string;
  ownerId: string;
  flowVersionId: string;
  flowTemplateId: string;
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepPosition: number | null;
  issueDate: string;
  dueDate: string | null;
  createdAt: Date;
  storedStatus: string;
  deletedAt: Date | null;
  currentStepOpenedAt: Date | null;
  completedSteps: number;
  totalSteps: number;
};

async function loadListCandidates(tx: AppTx): Promise<LoadedRow[]> {
  // Live invoices only for the main list (soft-deleted → listDeleted).
  const rows = await tx
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      partyName: invoices.partyName,
      amountMinor: invoices.amountMinor,
      currency: invoices.currency,
      ownerId: invoices.ownerId,
      flowVersionId: invoices.flowVersionId,
      flowTemplateId: flowVersions.templateId,
      currentStepId: invoices.currentStepId,
      currentStepName: flowSteps.name,
      currentStepPosition: flowSteps.position,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      storedStatus: invoices.status,
      deletedAt: invoices.deletedAt,
    })
    .from(invoices)
    .innerJoin(flowVersions, eq(invoices.flowVersionId, flowVersions.id))
    .leftJoin(flowSteps, eq(invoices.currentStepId, flowSteps.id))
    .where(isNull(invoices.deletedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const stepStats = await tx
    .select({
      invoiceId: invoiceSteps.invoiceId,
      completed: sql<number>`count(*) filter (where ${invoiceSteps.status} = 'completed')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(invoiceSteps)
    .where(inArray(invoiceSteps.invoiceId, ids))
    .groupBy(invoiceSteps.invoiceId);

  const statsById = new Map(stepStats.map((s) => [s.invoiceId, s]));

  const prevCompleted = await tx
    .select({
      invoiceId: invoiceSteps.invoiceId,
      flowStepId: invoiceSteps.flowStepId,
      completedAt: invoiceSteps.completedAt,
      position: flowSteps.position,
      status: invoiceSteps.status,
    })
    .from(invoiceSteps)
    .innerJoin(flowSteps, eq(invoiceSteps.flowStepId, flowSteps.id))
    .where(inArray(invoiceSteps.invoiceId, ids));

  const stepsByInvoice = new Map<string, typeof prevCompleted>();
  for (const s of prevCompleted) {
    const list = stepsByInvoice.get(s.invoiceId) ?? [];
    list.push(s);
    stepsByInvoice.set(s.invoiceId, list);
  }

  return rows.map((r) => {
    const stats = statsById.get(r.id);
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
    return {
      ...r,
      currentStepOpenedAt: openedAt,
      completedSteps: stats?.completed ?? 0,
      totalSteps: stats?.total ?? 0,
    };
  });
}

function toCandidate(row: LoadedRow, now: Date): ListCandidate & { loaded: LoadedRow } {
  const status = deriveInvoiceStatus({
    status: row.storedStatus,
    dueDate: row.dueDate,
    currentStepOpenedAt: row.currentStepOpenedAt,
    waitingDays: DEFAULT_WAITING_DAYS,
    now,
  });
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    partyName: row.partyName,
    ownerId: row.ownerId,
    flowTemplateId: row.flowTemplateId,
    currentStepId: row.currentStepId,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    status,
    deletedAt: row.deletedAt,
    loaded: row,
  };
}

/**
 * List invoices with tabs / filters / sort / keyset pagination.
 */
export async function list(
  ctx: AuthContext,
  query: ListInvoicesQuery,
  opts?: { now?: Date },
): Promise<InvoiceListResult> {
  const authed = assertCanReadInvoices(ctx);
  const now = opts?.now ?? new Date();

  return withUser(authed, async (tx) => {
    const loaded = await loadListCandidates(tx);
    const candidates = loaded.map((r) => toCandidate(r, now));
    const byId = new Map(candidates.map((c) => [c.id, c]));

    const listQuery: ListQuery = {
      tab: query.tab,
      flowId: query.flowId,
      stepId: query.stepId,
      ownerId: query.ownerId,
      issueDateFrom: query.issueDateFrom,
      issueDateTo: query.issueDateTo,
      sort: query.sort,
      sortDir: query.sortDir,
      cursor: query.cursor,
      limit: query.limit,
    };

    const { items, nextCursor } = applyListQuery(candidates, listQuery, authed.userId);

    return {
      items: items.map((c) => {
        const row = byId.get(c.id)!.loaded;
        return {
          id: c.id,
          invoiceNo: c.invoiceNo,
          partyName: c.partyName,
          amountRupees: paiseToRupees(row.amountMinor),
          currency: row.currency,
          status: c.status,
          ownerId: c.ownerId,
          flowTemplateId: c.flowTemplateId,
          flowVersionId: row.flowVersionId,
          currentStepId: c.currentStepId,
          currentStepName: row.currentStepName,
          currentStepNumber:
            row.currentStepPosition === null || row.currentStepPosition === undefined
              ? null
              : row.currentStepPosition + 1,
          issueDate: c.issueDate,
          dueDate: c.dueDate,
          createdAt: c.createdAt,
          progress: { completed: row.completedSteps, total: row.totalSteps },
        };
      }),
      nextCursor,
    };
  });
}

/** Re-export pure helpers for tests. */
export { applyListQuery, matchesFilters, matchesTab } from "./list-logic.js";
