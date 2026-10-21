import { requireCurrentUser } from "@/actions/auth";
import { flowsListSummariesAction } from "@/actions/flows";
import { invoicesListAction } from "@/actions/invoices";
import { usersListAction } from "@/actions/users";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { ErrorState } from "@/components/ui";
import { INVOICE_TABS, type InvoiceListItemUi, type InvoiceTab } from "@/lib/invoice-ui";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseTab(raw: string | undefined): InvoiceTab {
  if (raw && (INVOICE_TABS as readonly string[]).includes(raw)) {
    return raw as InvoiceTab;
  }
  return "all";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireCurrentUser("/invoices");
  const params = await searchParams;

  const tab = parseTab(first(params.tab));
  const filters = {
    flowId: first(params.flowId),
    ownerId: first(params.ownerId),
    issueDateFrom: first(params.issueDateFrom),
    issueDateTo: first(params.issueDateTo),
    sort: first(params.sort) ?? "createdAt",
    sortDir: first(params.sortDir) ?? "desc",
    cursor: first(params.cursor),
  };

  let list: Awaited<ReturnType<typeof invoicesListAction>> | null = null;
  let flows: Awaited<ReturnType<typeof flowsListSummariesAction>> = [];
  let users: Awaited<ReturnType<typeof usersListAction>> = [];
  let loadError: string | null = null;

  try {
    [list, flows, users] = await Promise.all([
      invoicesListAction({
        tab,
        flowId: filters.flowId,
        ownerId: filters.ownerId,
        issueDateFrom: filters.issueDateFrom,
        issueDateTo: filters.issueDateTo,
        sort: filters.sort,
        sortDir: filters.sortDir,
        cursor: filters.cursor,
        limit: 50,
      }),
      flowsListSummariesAction(),
      usersListAction(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Request failed";
  }

  if (loadError || !list) {
    return <ErrorState title="Could not load invoices" message={loadError ?? "Request failed"} />;
  }

  const ownerNames = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

  return (
    <InvoiceList
      items={list.items as InvoiceListItemUi[]}
      nextCursor={list.nextCursor}
      tab={tab}
      filters={filters}
      options={{
        flows: flows.map((f) => ({ id: f.id, name: f.name })),
        users: users
          .filter((u) => u.isActive && (u.role === "admin" || u.role === "builder"))
          .map((u) => ({ id: u.id, displayName: u.displayName })),
      }}
      canCreate={user.role === "admin" || user.role === "builder"}
      isAdmin={user.role === "admin"}
      ownerNames={ownerNames}
    />
  );
}
