"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { EmptyState, UploadProgress } from "@/components/ui";
import { apiFetch } from "@/lib/api-fetch";
import type { InvoiceDocumentUi, InvoiceStepUi } from "@/lib/invoice-ui";
import "./invoices.css";

export type InvoiceDocumentsProps = {
  steps: InvoiceStepUi[];
  currentInvoiceStepId: string | null;
  canUpload: boolean;
};

function allDocs(steps: InvoiceStepUi[]): InvoiceDocumentUi[] {
  return steps.flatMap((s) => s.documents);
}

export function InvoiceDocuments({
  steps,
  currentInvoiceStepId,
  canUpload,
}: InvoiceDocumentsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const docs = allDocs(steps);

  function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentInvoiceStepId) return;
    setError(null);
    startTransition(async () => {
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("invoiceStepId", currentInvoiceStepId);
        body.set("filename", file.name);
        const res = await apiFetch("/api/files/upload", {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(json?.error ?? "Upload failed");
          return;
        }
        router.refresh();
      } catch {
        setError("Upload failed");
      }
    });
  }

  return (
    <section className="inv-panel" aria-labelledby="inv-docs-heading">
      <h3 id="inv-docs-heading">Documents</h3>

      {canUpload && currentInvoiceStepId ? (
        <div style={{ marginBottom: "0.75rem" }}>
          <label className="ui-label" htmlFor="inv-doc-upload">
            Upload to current step
          </label>
          <input
            id="inv-doc-upload"
            className="ui-input"
            type="file"
            disabled={pending}
            onChange={onUpload}
          />
          {pending ? <UploadProgress /> : null}
          {error ? (
            <p className="ui-field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState title="No documents yet" description="Uploads for this invoice appear here." />
      ) : (
        <ul className="inv-doc-list">
          {docs.map((doc) => {
            const step = steps.find((s) => s.id === doc.invoiceStepId);
            return (
              <li key={doc.id}>
                <a href={`/api/files/${doc.id}`} download>
                  {doc.originalFilename}
                </a>
                <div className="ui-hint">
                  Step {step?.stepNumber ?? "?"} · {doc.mimeType} · {doc.sizeBytes} bytes
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
