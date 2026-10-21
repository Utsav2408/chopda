"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { stepsCompleteAction } from "@/actions/invoices";
import { fieldErrorsFromServer, type FieldErrors } from "@/components/forms/map-field-errors";
import { StepForm } from "@/components/steps/StepForm";
import { apiFetch } from "@/lib/api-fetch";
import type { StepFieldValues } from "@/lib/flow-fields";
import type { InvoiceStepUi } from "@/lib/invoice-ui";

export type InvoiceStepCompleteProps = {
  invoiceId: string;
  step: InvoiceStepUi;
  canComplete: boolean;
};

export function InvoiceStepComplete({ invoiceId, step, canComplete }: InvoiceStepCompleteProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors | null>(null);

  async function uploadFile(fieldKey: string, file: File): Promise<string> {
    const body = new FormData();
    body.set("file", file);
    body.set("invoiceStepId", step.id);
    body.set("filename", file.name);
    body.set("fieldKey", fieldKey);
    const res = await apiFetch("/api/files/upload", {
      method: "POST",
      body,
    });
    const json = (await res.json().catch(() => null)) as {
      error?: string;
      document?: { documentId?: string };
    } | null;
    if (!res.ok || !json?.document?.documentId) {
      setErrors({ [fieldKey]: json?.error ?? "Upload failed" });
      throw new Error(json?.error ?? "Upload failed");
    }
    return json.document.documentId;
  }

  function onSubmit(values: StepFieldValues) {
    setErrors(null);
    startTransition(async () => {
      try {
        await stepsCompleteAction({
          invoiceId,
          invoiceStepId: step.id,
          data: values,
        });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not complete step";
        setErrors(fieldErrorsFromServer({ error: message }));
      }
    });
  }

  if (!canComplete) {
    return (
      <p className="ui-hint">
        You can view this step but your role cannot complete it
        {step.allowedRole ? ` (needs ${step.allowedRole})` : ""}.
      </p>
    );
  }

  return (
    <StepForm
      fields={step.fields}
      defaultValues={step.data}
      errors={errors}
      disabled={pending}
      submitLabel={pending ? "Saving…" : "Complete step"}
      onUploadFile={uploadFile}
      onSubmit={onSubmit}
    />
  );
}
