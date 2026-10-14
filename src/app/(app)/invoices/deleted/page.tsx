import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/actions/auth";
import { invoicesListDeletedAction } from "@/actions/invoices";
import { UndoDeleteButton } from "@/components/invoices/SoftDeleteControls";
import { EmptyState, ErrorState, Table, type TableColumn } from "@/components/ui";
import { formatDate, type DeletedInvoiceUi } from "@/lib/invoice-ui";
import "@/components/invoices/invoices.css";

export default async function RecentlyDeletedPage() {
  const user = await requireCurrentUser("/invoices/deleted");
  if (user.role !== "admin") {
    redirect("/invoices");
  }

  let items: DeletedInvoiceUi[] = [];
  let loadError: string | null = null;

  try {
    items = (await invoicesListDeletedAction()) as DeletedInvoiceUi[];
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Request failed";
  }

  if (loadError) {
    return <ErrorState title="Could not load deleted invoices" message={loadError} />;
  }

  const columns: TableColumn<DeletedInvoiceUi>[] = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (row) => (
        <span>
          <strong>{row.invoiceNo}</strong>
          <div className="ui-hint">{row.partyName}</div>
        </span>
      ),
    },
    {
      key: "deletedAt",
      header: "Deleted",
      cell: (row) => formatDate(row.deletedAt),
    },
    {
      key: "daysLeft",
      header: "Days left",
      cell: (row) => String(row.daysLeft),
    },
    {
      key: "actions",
      header: "Restore",
      cell: (row) => <UndoDeleteButton invoiceId={row.id} />,
    },
  ];

  return (
    <div className="inv-stack">
      <div className="inv-page-header">
        <div>
          <p className="ui-hint" style={{ margin: 0 }}>
            <Link href="/invoices">Invoices</Link>
          </p>
          <h2 style={{ marginTop: "0.25rem" }}>Recently deleted</h2>
          <p className="ui-hint" style={{ margin: 0 }}>
            Soft-deleted invoices can be restored within 30 days.
          </p>
        </div>
      </div>

      <Table
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        caption="Recently deleted invoices"
        empty={
          <EmptyState
            title="Nothing deleted"
            description="Admin soft-deletes appear here until purge."
          />
        }
      />
    </div>
  );
}
