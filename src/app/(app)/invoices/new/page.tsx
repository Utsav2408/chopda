import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/actions/auth";
import { flowsListSummariesAction } from "@/actions/flows";
import { usersListAction } from "@/actions/users";
import { NewInvoiceForm } from "@/components/invoices/NewInvoiceForm";
import { ErrorState } from "@/components/ui";
import "@/components/invoices/invoices.css";

export default async function NewInvoicePage() {
  const user = await requireCurrentUser("/invoices/new");
  if (user.role !== "admin" && user.role !== "builder") {
    redirect("/invoices");
  }

  let flows: { id: string; name: string }[] = [];
  let users: { id: string; displayName: string; username: string }[] = [];
  let loadError: string | null = null;

  try {
    const [flowRows, userRows] = await Promise.all([flowsListSummariesAction(), usersListAction()]);
    flows = flowRows
      .filter((f) => f.publishedVersionNo != null && f.status !== "archived")
      .map((f) => ({ id: f.id, name: f.name }));
    users = userRows
      .filter((u) => u.isActive && (u.role === "admin" || u.role === "builder"))
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        username: u.username,
      }));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load form options";
  }

  return (
    <div className="inv-stack">
      <div className="inv-page-header">
        <div>
          <p className="ui-hint" style={{ margin: 0 }}>
            <Link href="/invoices">Invoices</Link>
          </p>
          <h2 style={{ marginTop: "0.25rem" }}>New invoice</h2>
        </div>
      </div>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <NewInvoiceForm flows={flows} users={users} defaultOwnerId={user.id} />
      )}
    </div>
  );
}
