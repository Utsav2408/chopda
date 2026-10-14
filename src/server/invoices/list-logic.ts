/**
 * Pure tab/filter/sort/keyset helpers for invoices.list (B7-01).
 * Unit-tested without a database.
 */
import type { DerivedInvoiceStatus } from "./status.js";

export type ListTab = "all" | "mine" | "waiting" | "overdue" | "completed";

export type ListSortField = "createdAt" | "issueDate" | "dueDate" | "invoiceNo" | "partyName";

export type ListSortDir = "asc" | "desc";

/** Row shape used by filter/sort/paginate (service maps DB → this). */
export type ListCandidate = {
  id: string;
  invoiceNo: string;
  partyName: string;
  ownerId: string;
  flowTemplateId: string;
  currentStepId: string | null;
  issueDate: string;
  dueDate: string | null;
  createdAt: Date;
  status: DerivedInvoiceStatus;
  deletedAt: Date | null;
};

export type ListQuery = {
  tab: ListTab;
  flowId?: string;
  stepId?: string;
  ownerId?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  sort?: ListSortField;
  sortDir?: ListSortDir;
  /** Opaque cursor from a previous page (JSON of sort values + id). */
  cursor?: string;
  limit?: number;
};

export type ListCursor = {
  id: string;
  sortValue: string;
};

export const DEFAULT_LIST_LIMIT = 25;
export const MAX_LIST_LIMIT = 100;

export function matchesTab(
  row: Pick<ListCandidate, "status" | "ownerId">,
  tab: ListTab,
  viewerUserId: string,
): boolean {
  switch (tab) {
    case "all":
      return true;
    case "mine":
      return row.ownerId === viewerUserId;
    case "waiting":
      return row.status === "waiting";
    case "overdue":
      return row.status === "overdue";
    case "completed":
      return row.status === "completed";
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export function matchesFilters(
  row: ListCandidate,
  query: Pick<ListQuery, "flowId" | "stepId" | "ownerId" | "issueDateFrom" | "issueDateTo">,
): boolean {
  if (query.flowId && row.flowTemplateId !== query.flowId) return false;
  if (query.stepId && row.currentStepId !== query.stepId) return false;
  if (query.ownerId && row.ownerId !== query.ownerId) return false;
  if (query.issueDateFrom && row.issueDate < query.issueDateFrom) return false;
  if (query.issueDateTo && row.issueDate > query.issueDateTo) return false;
  return true;
}

function sortValueOf(row: ListCandidate, field: ListSortField): string {
  switch (field) {
    case "createdAt":
      return row.createdAt.toISOString();
    case "issueDate":
      return row.issueDate;
    case "dueDate":
      return row.dueDate ?? "";
    case "invoiceNo":
      return row.invoiceNo;
    case "partyName":
      return row.partyName;
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

export function compareListRows(
  a: ListCandidate,
  b: ListCandidate,
  field: ListSortField,
  dir: ListSortDir,
): number {
  const av = sortValueOf(a, field);
  const bv = sortValueOf(b, field);
  let cmp = av < bv ? -1 : av > bv ? 1 : 0;
  if (cmp === 0) {
    cmp = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function encodeListCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeListCursor(raw: string): ListCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as ListCursor).id === "string" &&
      typeof (parsed as ListCursor).sortValue === "string"
    ) {
      return parsed as ListCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply tab + filters, sort, then keyset-paginate.
 * Cursor is exclusive: rows strictly after the cursor in sort order.
 */
export function applyListQuery(
  rows: ListCandidate[],
  query: ListQuery,
  viewerUserId: string,
): { items: ListCandidate[]; nextCursor: string | null } {
  const sort = query.sort ?? "createdAt";
  const sortDir = query.sortDir ?? "desc";
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

  let filtered = rows.filter(
    (r) =>
      r.deletedAt === null && matchesTab(r, query.tab, viewerUserId) && matchesFilters(r, query),
  );
  filtered.sort((a, b) => compareListRows(a, b, sort, sortDir));

  if (query.cursor) {
    const cursor = decodeListCursor(query.cursor);
    if (cursor) {
      const cursorAsRow: ListCandidate = {
        id: cursor.id,
        invoiceNo: sort === "invoiceNo" ? cursor.sortValue : "",
        partyName: sort === "partyName" ? cursor.sortValue : "",
        ownerId: "",
        flowTemplateId: "",
        currentStepId: null,
        issueDate: sort === "issueDate" ? cursor.sortValue : "1970-01-01",
        dueDate: sort === "dueDate" ? cursor.sortValue || null : null,
        createdAt: sort === "createdAt" ? new Date(cursor.sortValue) : new Date(0),
        status: "open",
        deletedAt: null,
      };
      // Exclusive keyset: keep rows that sort strictly after the cursor.
      filtered = filtered.filter((row) => compareListRows(row, cursorAsRow, sort, sortDir) > 0);
    }
  }

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeListCursor({ id: last.id, sortValue: sortValueOf(last, sort) }) : null;

  return { items: page, nextCursor };
}
