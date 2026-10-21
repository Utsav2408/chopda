"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { invoicesCreateAction } from "@/actions/invoices";
import { FormField } from "@/components/forms/FormField";
import { fieldErrorsFromZod, type FieldErrors } from "@/components/forms/map-field-errors";
import { createInvoiceInputSchema } from "@/lib/create-invoice-schema";
import { useAppNavigate } from "@/lib/navigate";

export type FlowOption = { id: string; name: string };
export type UserOption = { id: string; displayName: string; username: string };

export type NewInvoiceFormProps = {
  flows: FlowOption[];
  users: UserOption[];
  defaultOwnerId: string;
};

export function NewInvoiceForm({ flows, users, defaultOwnerId }: NewInvoiceFormProps) {
  const navigate = useAppNavigate();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(null);
    const form = new FormData(event.currentTarget);
    const raw = {
      invoiceNo: String(form.get("invoiceNo") ?? "").trim(),
      partyName: String(form.get("partyName") ?? "").trim(),
      amountRupees: String(form.get("amountRupees") ?? "").trim(),
      issueDate: String(form.get("issueDate") ?? ""),
      dueDate: String(form.get("dueDate") ?? "") || undefined,
      ownerId: String(form.get("ownerId") ?? ""),
      flowId: String(form.get("flowId") ?? ""),
    };

    const parsed = createInvoiceInputSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    startTransition(async () => {
      try {
        const created = await invoicesCreateAction(parsed.data);
        navigate.push(`/invoices/${created.id}`);
        navigate.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not create invoice";
        setErrors({ _form: message });
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form className="inv-panel inv-stack" onSubmit={onSubmit} noValidate>
      <FormField name="invoiceNo" label="Invoice number" required errors={errors}>
        <input
          id="invoiceNo"
          className="ui-input"
          name="invoiceNo"
          required
          maxLength={64}
          autoComplete="off"
          aria-invalid={errors?.invoiceNo ? true : undefined}
        />
      </FormField>

      <FormField name="partyName" label="Party name" required errors={errors}>
        <input
          id="partyName"
          className="ui-input"
          name="partyName"
          required
          maxLength={200}
          aria-invalid={errors?.partyName ? true : undefined}
        />
      </FormField>

      <FormField
        name="amountRupees"
        label="Amount (rupees)"
        required
        hint="Enter rupees with up to 2 decimals; stored as paise."
        errors={errors}
      >
        <input
          id="amountRupees"
          className="ui-input"
          name="amountRupees"
          inputMode="decimal"
          required
          placeholder="0.00"
          aria-invalid={errors?.amountRupees ? true : undefined}
        />
      </FormField>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
        <FormField name="issueDate" label="Issue date" required errors={errors}>
          <input
            id="issueDate"
            className="ui-input"
            name="issueDate"
            type="date"
            required
            defaultValue={today}
            aria-invalid={errors?.issueDate ? true : undefined}
          />
        </FormField>
        <FormField name="dueDate" label="Due date" errors={errors}>
          <input
            id="dueDate"
            className="ui-input"
            name="dueDate"
            type="date"
            aria-invalid={errors?.dueDate ? true : undefined}
          />
        </FormField>
      </div>

      <FormField name="ownerId" label="Owner" required errors={errors}>
        <select
          id="ownerId"
          className="ui-input"
          name="ownerId"
          required
          defaultValue={defaultOwnerId}
          aria-invalid={errors?.ownerId ? true : undefined}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.username})
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        name="flowId"
        label="Flow"
        required
        hint="Only published flows can start an invoice."
        errors={errors}
      >
        <select
          id="flowId"
          className="ui-input"
          name="flowId"
          required
          defaultValue={flows[0]?.id ?? ""}
          aria-invalid={errors?.flowId ? true : undefined}
        >
          {flows.length === 0 ? <option value="">No published flows</option> : null}
          {flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </FormField>

      {errors?._form ? (
        <p className="ui-field-error" role="alert">
          {errors._form}
        </p>
      ) : null}

      <div className="inv-page-header__actions">
        <button type="submit" className="ui-btn" disabled={pending || flows.length === 0}>
          {pending ? "Creating…" : "Create invoice"}
        </button>
        <Link className="ui-btn ui-btn--ghost" href="/invoices">
          Cancel
        </Link>
      </div>
    </form>
  );
}
