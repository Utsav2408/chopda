import Link from "next/link";
import { StatusChip, Stepper } from "@/components/ui";
import {
  formatDate,
  formatMoney,
  statusTone,
  type HistoryEntryUi,
  type InvoiceDetailUi,
} from "@/lib/invoice-ui";
import { InvoiceDocuments } from "./InvoiceDocuments";
import { InvoiceHistory } from "./InvoiceHistory";
import { InvoiceStepComplete } from "./InvoiceStepComplete";
import { SoftDeleteButton } from "./SoftDeleteControls";
import "./invoices.css";

export type InvoiceDetailProps = {
  invoice: InvoiceDetailUi;
  history: HistoryEntryUi[];
  role: "admin" | "builder" | "viewer";
  userNames: Record<string, string>;
};

export function InvoiceDetail({ invoice, history, role, userNames }: InvoiceDetailProps) {
  const sorted = [...invoice.steps].sort((a, b) => a.position - b.position);
  const current = sorted.find((s) => s.flowStepId === invoice.currentStepId) ?? null;
  const done = sorted.filter((s) => s.status === "completed");
  const canMutate = role === "admin" || role === "builder";
  const canComplete =
    canMutate && current !== null && (role === "admin" || current.allowedRole === role);

  const stepperSteps = sorted.map((s) => ({
    id: s.id,
    label: `${s.stepNumber}. ${s.name}`,
    meta:
      s.status === "completed" && s.completedAt
        ? `Done · ${formatDate(s.completedAt)}`
        : s.flowStepId === invoice.currentStepId
          ? `Needs ${s.allowedRole}`
          : undefined,
    state:
      s.status === "completed"
        ? ("done" as const)
        : s.flowStepId === invoice.currentStepId
          ? ("current" as const)
          : ("todo" as const),
  }));

  return (
    <div className="inv-stack">
      <div className="inv-page-header">
        <div>
          <p className="ui-hint" style={{ margin: 0 }}>
            <Link href="/invoices">Invoices</Link>
          </p>
          <h2 style={{ marginTop: "0.25rem" }}>{invoice.invoiceNo}</h2>
          <p style={{ margin: 0 }}>
            {invoice.partyName} ·{" "}
            <StatusChip tone={statusTone(invoice.status)}>{invoice.status}</StatusChip>
          </p>
        </div>
        <div className="inv-page-header__actions">
          {role === "admin" ? <SoftDeleteButton invoiceId={invoice.id} /> : null}
        </div>
      </div>

      <div className="inv-grid-2">
        <div className="inv-stack">
          <section className="inv-panel">
            <h3>Progress</h3>
            <Stepper steps={stepperSteps} ariaLabel="Invoice steps" />
          </section>

          {current && invoice.status !== "completed" && invoice.status !== "cancelled" ? (
            <section className="inv-panel" aria-labelledby="inv-current-step">
              <h3 id="inv-current-step">
                Current step · {current.stepNumber}. {current.name}
              </h3>
              <InvoiceStepComplete
                invoiceId={invoice.id}
                step={current}
                canComplete={Boolean(canComplete)}
              />
            </section>
          ) : null}

          {done.length > 0 ? (
            <section className="inv-panel" aria-labelledby="inv-done-steps">
              <h3 id="inv-done-steps">Completed steps</h3>
              {done.map((s) => (
                <div key={s.id} className="inv-done-step">
                  <strong>
                    {s.stepNumber}. {s.name}
                  </strong>
                  <div className="ui-hint">
                    {s.completedBy
                      ? (userNames[s.completedBy] ?? s.completedBy.slice(0, 8))
                      : "Unknown"}{" "}
                    · {formatDate(s.completedAt)}
                  </div>
                  {s.documents.length > 0 ? (
                    <ul className="inv-doc-list" style={{ marginTop: "0.5rem" }}>
                      {s.documents.map((d) => (
                        <li key={d.id}>
                          <a href={`/api/files/${d.id}`} download>
                            {d.originalFilename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <aside className="inv-stack">
          <section className="inv-panel">
            <h3>Details</h3>
            <ul className="inv-meta-list">
              <li>
                <span className="inv-meta-label">Amount</span>
                <span>{formatMoney(invoice.amountRupees, invoice.currency)}</span>
              </li>
              <li>
                <span className="inv-meta-label">Issue</span>
                <span>{invoice.issueDate}</span>
              </li>
              <li>
                <span className="inv-meta-label">Due</span>
                <span>{invoice.dueDate ?? "—"}</span>
              </li>
              <li>
                <span className="inv-meta-label">Owner</span>
                <span>{userNames[invoice.ownerId] ?? invoice.ownerId.slice(0, 8)}</span>
              </li>
              <li>
                <span className="inv-meta-label">Created</span>
                <span>{formatDate(invoice.createdAt)}</span>
              </li>
            </ul>
          </section>

          <InvoiceDocuments
            steps={sorted}
            currentInvoiceStepId={
              canMutate && current && current.status !== "completed" ? current.id : null
            }
            canUpload={canMutate}
          />

          <InvoiceHistory entries={history} actorNames={userNames} />
        </aside>
      </div>
    </div>
  );
}
