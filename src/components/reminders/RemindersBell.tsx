"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { remindersComputeAction, remindersDismissAction } from "@/actions/invoices";
import { IconBell } from "@/components/icons/Icons";
import { StatusChip } from "@/components/ui";
import type { ReminderItemUi } from "@/lib/invoice-ui";
import "@/components/invoices/invoices.css";

function badgeUrgency(items: ReminderItemUi[]): "danger" | "warning" {
  // Waiting past expected step time is overdue-adjacent; due-soon alone is warning.
  return items.some((i) => i.kind === "waiting") ? "danger" : "warning";
}

export type RemindersBellProps = {
  initialItems?: ReminderItemUi[];
};

export function RemindersBell({ initialItems = [] }: RemindersBellProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReminderItemUi[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        const next = await remindersComputeAction();
        setItems(next as ReminderItemUi[]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load reminders");
      } finally {
        setRefreshing(false);
      }
    });
  }

  // Load on mount so the layout need not block on reminders (cold-start).
  useEffect(() => {
    startTransition(async () => {
      try {
        const next = await remindersComputeAction();
        setItems(next as ReminderItemUi[]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load reminders");
      }
    });
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
    setDismissingKey(key);
    startTransition(async () => {
      try {
        await remindersDismissAction(key);
        setItems((prev) => prev.filter((i) => i.key !== key));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dismiss failed");
      } finally {
        setDismissingKey(null);
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
          // Soft refresh when opening so dismissals from other tabs stay current.
          if (next) load();
        }}
      >
        <IconBell className="reminders-bell__icon" />
        {items.length > 0 ? (
          <span
            className="reminders-bell__badge"
            data-urgency={badgeUrgency(items)}
            aria-hidden="true"
          >
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

          {refreshing ? <p className="ui-hint">Refreshing…</p> : null}

          {!refreshing && items.length === 0 ? (
            <p className="ui-hint">No active reminders.</p>
          ) : (
            <ul className="inv-reminder-list">
              {items.map((item) => {
                const dismissing = dismissingKey === item.key;
                return (
                  <li key={item.key} className="inv-history-item" data-kind={item.kind}>
                    <div>
                      <Link href={`/invoices/${item.invoiceId}`} onClick={() => setOpen(false)}>
                        {item.invoiceNo}
                      </Link>{" "}
                      · {item.partyName}
                    </div>
                    <div className="inv-reminder-kind">
                      <StatusChip tone={item.kind === "waiting" ? "info" : "warning"}>
                        {item.kind === "waiting"
                          ? `Waiting ${item.days} day${item.days === 1 ? "" : "s"}`
                          : `Due in ${item.days} day${item.days === 1 ? "" : "s"}`}
                      </StatusChip>
                    </div>
                    <button
                      type="button"
                      className="ui-btn ui-btn--ghost"
                      style={{ marginTop: "0.35rem", minHeight: "1.75rem" }}
                      disabled={dismissing || dismissingKey !== null}
                      onClick={() => dismiss(item.key)}
                    >
                      {dismissing ? "Dismissing…" : "Dismiss"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
