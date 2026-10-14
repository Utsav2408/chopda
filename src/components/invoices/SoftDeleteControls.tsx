"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { invoicesSoftDeleteAction, invoicesUndoAction } from "@/actions/invoices";
import { ConfirmDialog } from "@/components/ui";

export function SoftDeleteButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await invoicesSoftDeleteAction(invoiceId);
        setOpen(false);
        router.push("/invoices");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <button type="button" className="ui-btn ui-btn--danger" onClick={() => setOpen(true)}>
        Delete
      </button>
      {error ? (
        <p className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        title="Delete this invoice?"
        description="It will be hidden for 30 days. You can restore it from Recently deleted before purge."
        confirmLabel="Delete invoice"
        danger
        busy={pending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function UndoDeleteButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onUndo() {
    setError(null);
    startTransition(async () => {
      try {
        await invoicesUndoAction(invoiceId);
        router.push(`/invoices/${invoiceId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Restore failed");
      }
    });
  }

  return (
    <div>
      <button type="button" className="ui-btn" onClick={onUndo} disabled={pending}>
        {pending ? "Restoring…" : "Undo delete"}
      </button>
      {error ? (
        <p className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
