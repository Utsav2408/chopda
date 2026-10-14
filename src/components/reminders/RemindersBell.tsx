"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { remindersComputeAction, remindersDismissAction } from "@/actions/invoices";
import type { ReminderItemUi } from "@/lib/invoice-ui";
import "@/components/invoices/invoices.css";

export function RemindersBell() {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReminderItemUi[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const next = await remindersComputeAction();
        setItems(next as ReminderItemUi[]);
        setLoaded(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load reminders");
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function dismiss(key: string) {
    startTransition(async () => {
      try {
        await remindersDismissAction(key);
        setItems((prev) => prev.filter((i) => i.key !== key));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dismiss failed");
      }
    });
  }

  return (
    <div className="reminders-bell" ref={rootRef}>
      <button
        type="button"
        className="reminders-bell__btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Reminders${items.length ? `, ${items.length} active` : ""}`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) load();
        }}
      >
        Bell
        {items.length > 0 ? (
          <span className="reminders-bell__badge" aria-hidden="true">
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div id={panelId} className="reminders-panel" role="dialog" aria-label="Reminders">
          <div className="reminders-panel__header">
            <h2>Reminders</h2>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={() => setOpen(false)}
              style={{ minHeight: "1.75rem", padding: "0.2rem 0.5rem" }}
            >
              Close
            </button>
          </div>

          {error ? (
            <p className="ui-field-error" role="alert">
              {error}
            </p>
          ) : null}

          {!loaded && pending ? <p className="ui-hint">Loading…</p> : null}

          {loaded && items.length === 0 ? (
            <p className="ui-hint">No active reminders.</p>
          ) : (
            <ul className="inv-reminder-list">
              {items.map((item) => (
                <li key={item.key} className="inv-history-item">
                  <div>
                    <Link href={`/invoices/${item.invoiceId}`} onClick={() => setOpen(false)}>
                      {item.invoiceNo}
                    </Link>{" "}
                    · {item.partyName}
                  </div>
                  <div className="inv-history-meta">
                    {item.kind === "waiting"
                      ? `Waiting ${item.days} day${item.days === 1 ? "" : "s"}`
                      : `Due in ${item.days} day${item.days === 1 ? "" : "s"}`}
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost"
                    style={{ marginTop: "0.35rem", minHeight: "1.75rem" }}
                    disabled={pending}
                    onClick={() => dismiss(item.key)}
                  >
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
