import { EmptyState } from "@/components/ui";
import { actionLabel, formatDate, type HistoryEntryUi } from "@/lib/invoice-ui";
import "./invoices.css";

export type InvoiceHistoryProps = {
  entries: HistoryEntryUi[];
  actorNames: Record<string, string>;
};

export function InvoiceHistory({ entries, actorNames }: InvoiceHistoryProps) {
  return (
    <section className="inv-panel" aria-labelledby="inv-history-heading">
      <h3 id="inv-history-heading">History</h3>
      {entries.length === 0 ? (
        <EmptyState title="No history yet" description="Actions on this invoice will show here." />
      ) : (
        <ul className="inv-history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="inv-history-item">
              <div>{actionLabel(entry.action)}</div>
              <div className="inv-history-meta">
                {entry.actorId
                  ? (actorNames[entry.actorId] ?? entry.actorId.slice(0, 8))
                  : "System"}{" "}
                · {formatDate(entry.at)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
