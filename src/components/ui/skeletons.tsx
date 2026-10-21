import { Skeleton } from "./Skeleton";
import "@/components/invoices/invoices.css";

function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }, (_, i) => (
        <td key={i}>
          <Skeleton height="0.85rem" width={i === 0 ? "70%" : "50%"} />
        </td>
      ))}
    </tr>
  );
}

function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i}>
                <Skeleton height="0.65rem" width="4rem" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Dashboard content skeleton (loader type B). */
export function DashboardSkeleton() {
  return (
    <div className="inv-stack" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading dashboard…</span>
      <div className="inv-page-header">
        <div style={{ display: "grid", gap: "0.5rem", width: "100%", maxWidth: "16rem" }}>
          <Skeleton height="1.5rem" width="9rem" />
          <Skeleton height="0.85rem" width="14rem" />
        </div>
      </div>

      <div className="dash-counts">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="dash-count">
            <Skeleton height="1.75rem" width="3rem" style={{ marginBottom: "0.5rem" }} />
            <Skeleton height="0.7rem" width="4rem" />
          </div>
        ))}
      </div>

      <div className="inv-grid-2">
        <section className="inv-panel">
          <Skeleton height="1rem" width="8rem" style={{ marginBottom: "1rem" }} />
          <TableSkeleton rows={4} cols={4} />
        </section>
        <section className="inv-panel">
          <Skeleton height="1rem" width="7rem" style={{ marginBottom: "1rem" }} />
          <TableSkeleton rows={4} cols={2} />
        </section>
      </div>

      <div className="inv-grid-2">
        <section className="inv-panel">
          <Skeleton height="1rem" width="8rem" style={{ marginBottom: "1rem" }} />
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} style={{ display: "grid", gap: "0.35rem" }}>
                <Skeleton height="0.85rem" width="80%" />
                <Skeleton height="0.7rem" width="40%" />
              </div>
            ))}
          </div>
        </section>
        <section className="inv-panel">
          <Skeleton height="1rem" width="7rem" style={{ marginBottom: "1rem" }} />
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height="0.85rem" width={`${60 + (i % 3) * 10}%`} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Invoice list content skeleton (loader type B). */
export function InvoiceListSkeleton() {
  return (
    <div className="inv-stack" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading invoices…</span>
      <div className="inv-page-header">
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <Skeleton height="1.5rem" width="7rem" />
        </div>
        <Skeleton height="2.25rem" width="7rem" rounded="md" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height="2rem" width="4.5rem" rounded="full" />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
          alignItems: "flex-end",
        }}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ display: "grid", gap: "0.35rem", minWidth: "8rem" }}>
            <Skeleton height="0.65rem" width="3rem" />
            <Skeleton height="2.25rem" width="100%" />
          </div>
        ))}
        <Skeleton height="2.25rem" width="5rem" />
      </div>

      <TableSkeleton rows={9} cols={6} />
    </div>
  );
}

/** Invoice detail content skeleton (loader type B). */
export function InvoiceDetailSkeleton() {
  return (
    <div className="inv-stack" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading invoice…</span>
      <div className="inv-page-header">
        <div style={{ display: "grid", gap: "0.5rem", width: "100%", maxWidth: "20rem" }}>
          <Skeleton height="0.75rem" width="4rem" />
          <Skeleton height="1.5rem" width="10rem" />
          <Skeleton height="0.9rem" width="14rem" />
        </div>
      </div>

      <div className="inv-grid-2">
        <div className="inv-stack">
          <section className="inv-panel">
            <Skeleton height="1rem" width="5rem" style={{ marginBottom: "1rem" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} height="2.5rem" width="6rem" rounded="full" />
              ))}
            </div>
          </section>
          <section className="inv-panel">
            <Skeleton height="1rem" width="10rem" style={{ marginBottom: "1rem" }} />
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <Skeleton height="2.25rem" width="100%" />
              <Skeleton height="2.25rem" width="100%" />
              <Skeleton height="5rem" width="100%" />
              <Skeleton height="2.25rem" width="8rem" />
            </div>
          </section>
        </div>

        <div className="inv-stack">
          <section className="inv-panel">
            <Skeleton height="1rem" width="5rem" style={{ marginBottom: "1rem" }} />
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  style={{ display: "grid", gridTemplateColumns: "7rem 1fr", gap: "0.5rem" }}
                >
                  <Skeleton height="0.85rem" width="100%" />
                  <Skeleton height="0.85rem" width="70%" />
                </div>
              ))}
            </div>
          </section>
          <section className="inv-panel">
            <Skeleton height="1rem" width="6rem" style={{ marginBottom: "1rem" }} />
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} height="0.85rem" width={`${75 - i * 10}%`} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
