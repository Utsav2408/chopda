import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/actions/auth";
import { invoicesDetailPageAction } from "@/actions/invoices";
import { InvoiceDetail } from "@/components/invoices/InvoiceDetail";
import { ErrorState } from "@/components/ui";
import type { HistoryEntryUi, InvoiceDetailUi } from "@/lib/invoice-ui";
import "@/components/invoices/invoices.css";

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: string }).name === "NotFound"
  );
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;

  let invoice: InvoiceDetailUi | null = null;
  let history: HistoryEntryUi[] = [];
  let userNames: Record<string, string> = {};
  let loadError: string | null = null;

  try {
    const page = await invoicesDetailPageAction(id);
    invoice = page.invoice as InvoiceDetailUi;
    history = page.history as HistoryEntryUi[];
    userNames = page.userNames;
  } catch (err) {
    if (isNotFoundError(err)) {
      notFound();
    }
    loadError = err instanceof Error ? err.message : "Request failed";
  }

  if (loadError || !invoice) {
    return (
      <div className="inv-stack">
        <ErrorState
          title="Could not load invoice"
          message={loadError ?? "Request failed"}
          action={
            <Link className="ui-btn ui-btn--ghost" href="/invoices">
              Back to invoices
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <InvoiceDetail invoice={invoice} history={history} role={user.role} userNames={userNames} />
  );
}
