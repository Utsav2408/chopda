"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import {
  FilterBar,
  FilterField,
  StatusChip,
  Table,
  Tabs,
  EmptyState,
  type TableColumn,
} from "@/components/ui";
import {
  formatDate,
  formatMoney,
  statusTone,
  type InvoiceListItemUi,
  type InvoiceTab,
  INVOICE_TABS,
} from "@/lib/invoice-ui";
import "./invoices.css";

export type InvoiceListFilterOptions = {
  flows: { id: string; name: string }[];
  users: { id: string; displayName: string }[];
};

export type InvoiceListProps = {
  items: InvoiceListItemUi[];
  nextCursor: string | null;
  tab: InvoiceTab;
  filters: {
    flowId?: string;
    ownerId?: string;
    issueDateFrom?: string;
    issueDateTo?: string;
    sort?: string;
    sortDir?: string;
  };
  options: InvoiceListFilterOptions;
  canCreate: boolean;
  isAdmin: boolean;
  ownerNames: Record<string, string>;
};

function buildQuery(
  tab: string,
  filters: InvoiceListProps["filters"],
  extras?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (tab && tab !== "all") params.set("tab", tab);
  if (filters.flowId) params.set("flowId", filters.flowId);
  if (filters.ownerId) params.set("ownerId", filters.ownerId);
  if (filters.issueDateFrom) params.set("issueDateFrom", filters.issueDateFrom);
  if (filters.issueDateTo) params.set("issueDateTo", filters.issueDateTo);
  if (filters.sort && filters.sort !== "createdAt") params.set("sort", filters.sort);
  if (filters.sortDir && filters.sortDir !== "desc") params.set("sortDir", filters.sortDir);
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
  }
  const qs = params.toString();
  return qs ? `/invoices?${qs}` : "/invoices";
}

const TAB_LABELS: Record<InvoiceTab, string> = {
  all: "All",
  mine: "Mine",
  waiting: "Waiting",
  overdue: "Overdue",
  completed: "Completed",
};

export function InvoiceList({
  items,
  nextCursor,
  tab,
  filters,
  options,
  canCreate,
  isAdmin,
  ownerNames,
}: InvoiceListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  function onFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    go(
      buildQuery(tab, {
        flowId: String(form.get("flowId") || "") || undefined,
        ownerId: String(form.get("ownerId") || "") || undefined,
        issueDateFrom: String(form.get("issueDateFrom") || "") || undefined,
        issueDateTo: String(form.get("issueDateTo") || "") || undefined,
        sort: String(form.get("sort") || "createdAt"),
        sortDir: String(form.get("sortDir") || "desc"),
      }),
    );
  }

  const columns: TableColumn<InvoiceListItemUi>[] = [
    {
      key: "invoiceNo",
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
      key: "step",
      header: "Current step",
      cell: (row) =>
        row.currentStepName
          ? `${row.currentStepNumber ?? ""}. ${row.currentStepName}`
          : row.status === "completed"
            ? "Done"
            : "—",
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row) => ownerNames[row.ownerId] ?? row.ownerId.slice(0, 8),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => formatMoney(row.amountRupees, row.currency),
    },
    {
      key: "dates",
      header: "Issue / due",
      cell: (row) => (
        <span>
          {row.issueDate}
          <br />
          <span className="ui-hint">{row.dueDate ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      cell: (row) => `${row.progress.completed}/${row.progress.total}`,
    },
  ];

  return (
    <div className="inv-stack">
      <div className="inv-page-header">
        <div>
          <h2>Invoices</h2>
          <p className="ui-hint" style={{ margin: 0 }}>
            Tabs and filters are stored in the URL.
          </p>
        </div>
        <div className="inv-page-header__actions">
          {isAdmin ? (
            <Link className="ui-btn ui-btn--ghost" href="/invoices/deleted">
              Recently deleted
            </Link>
          ) : null}
          {canCreate ? (
            <Link className="ui-btn" href="/invoices/new">
              New invoice
            </Link>
          ) : null}
        </div>
      </div>

      <Tabs
        label="Invoice tabs"
        activeTabId={tab}
        onTabChange={(id) => go(buildQuery(id, filters))}
        items={INVOICE_TABS.map((id) => ({
          id,
          label: TAB_LABELS[id],
          panel:
            id === tab ? (
              <div className="inv-stack">
                <FilterBar onSubmit={onFilterSubmit} ariaLabel="Invoice filters">
                  <FilterField label="Flow" htmlFor="filter-flow">
                    <select
                      id="filter-flow"
                      className="ui-input"
                      name="flowId"
                      defaultValue={filters.flowId ?? ""}
                    >
                      <option value="">All flows</option>
                      {options.flows.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Owner" htmlFor="filter-owner">
                    <select
                      id="filter-owner"
                      className="ui-input"
                      name="ownerId"
                      defaultValue={filters.ownerId ?? ""}
                    >
                      <option value="">All owners</option>
                      {options.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Issue from" htmlFor="filter-from">
                    <input
                      id="filter-from"
                      className="ui-input"
                      type="date"
                      name="issueDateFrom"
                      defaultValue={filters.issueDateFrom ?? ""}
                    />
                  </FilterField>
                  <FilterField label="Issue to" htmlFor="filter-to">
                    <input
                      id="filter-to"
                      className="ui-input"
                      type="date"
                      name="issueDateTo"
                      defaultValue={filters.issueDateTo ?? ""}
                    />
                  </FilterField>
                  <FilterField label="Sort" htmlFor="filter-sort">
                    <select
                      id="filter-sort"
                      className="ui-input"
                      name="sort"
                      defaultValue={filters.sort ?? "createdAt"}
                    >
                      <option value="createdAt">Created</option>
                      <option value="issueDate">Issue date</option>
                      <option value="dueDate">Due date</option>
                      <option value="invoiceNo">Invoice no</option>
                      <option value="partyName">Party</option>
                    </select>
                  </FilterField>
                  <FilterField label="Direction" htmlFor="filter-dir">
                    <select
                      id="filter-dir"
                      className="ui-input"
                      name="sortDir"
                      defaultValue={filters.sortDir ?? "desc"}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </FilterField>
                  <button type="submit" className="ui-btn" disabled={pending}>
                    Apply
                  </button>
                  <Link className="ui-btn ui-btn--ghost" href="/invoices">
                    Reset
                  </Link>
                </FilterBar>

                <Table
                  columns={columns}
                  rows={items}
                  rowKey={(row) => row.id}
                  caption="Invoices"
                  empty={
                    <EmptyState
                      title="No invoices match"
                      description="Try another tab or clear filters."
                      action={
                        canCreate ? (
                          <Link className="ui-btn" href="/invoices/new">
                            New invoice
                          </Link>
                        ) : undefined
                      }
                    />
                  }
                />

                {nextCursor ? (
                  <div>
                    <Link
                      className="ui-btn ui-btn--ghost"
                      href={buildQuery(tab, filters, { cursor: nextCursor })}
                    >
                      Load more
                    </Link>
                  </div>
                ) : null}

                <p className="ui-hint" style={{ margin: 0 }}>
                  Showing {items.length} · sorted by {filters.sort ?? "createdAt"} (
                  {filters.sortDir ?? "desc"})
                  {items[0] ? ` · newest shown ${formatDate(items[0].createdAt)}` : ""}
                </p>
              </div>
            ) : (
              <span className="sr-only">Switch tab to load</span>
            ),
        }))}
      />
    </div>
  );
}
