import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/actions/auth";
import { invoiceHistoryAction, invoicesGetAction } from "@/actions/invoices";
import { usersListAction } from "@/actions/users";
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

  let invoice: Awaited<ReturnType<typeof invoicesGetAction>> | null = null;
  let history: Awaited<ReturnType<typeof invoiceHistoryAction>> = [];
  let users: Awaited<ReturnType<typeof usersListAction>> = [];
  let loadError: string | null = null;

  try {
    [invoice, history, users] = await Promise.all([
      invoicesGetAction(id),
      invoiceHistoryAction(id),
      usersListAction(),
    ]);
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

  const userNames = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

  return (
    <InvoiceDetail
      invoice={invoice as InvoiceDetailUi}
      history={history as HistoryEntryUi[]}
      role={user.role}
      userNames={userNames}
    />
  );
}
