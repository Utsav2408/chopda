"use client";

import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { FormField } from "@/components/forms/FormField";
import type { FieldErrors } from "@/components/forms/map-field-errors";
import { UploadProgress } from "@/components/ui";
import type { StepField, StepFieldValues } from "@/lib/flow-fields";

export type StepFormProps = {
  fields: StepField[];
  /** Controlled values; when omitted the form keeps local state. */
  values?: StepFieldValues;
  defaultValues?: StepFieldValues;
  errors?: FieldErrors | null;
  disabled?: boolean;
  /** Preview mode: inputs are interactive but marked as preview. */
  preview?: boolean;
  submitLabel?: string;
  onChange?: (values: StepFieldValues) => void;
  onSubmit?: (values: StepFieldValues) => void | Promise<void>;
  /**
   * When set, file fields upload immediately and store the returned document id.
   * Used by invoice step completion (U4-04).
   */
  onUploadFile?: (fieldKey: string, file: File) => Promise<string>;
};

function coerceInitial(fields: StepField[], seed?: StepFieldValues): StepFieldValues {
  const next: StepFieldValues = {};
  for (const field of fields) {
    if (seed && seed[field.key] !== undefined) {
      next[field.key] = seed[field.key];
      continue;
    }
    if (field.type === "confirm") next[field.key] = false;
    else if (field.type === "number") next[field.key] = "";
    else next[field.key] = "";
  }
  return next;
}

export function StepForm({
  fields,
  values: controlled,
  defaultValues,
  errors,
  disabled = false,
  preview = false,
  submitLabel = "Continue",
  onChange,
  onSubmit,
  onUploadFile,
}: StepFormProps) {
  const formId = useId();
  const [local, setLocal] = useState(() => coerceInitial(fields, defaultValues));
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const values = controlled ?? local;
  const readOnly = disabled || preview;

  function setValue(key: string, value: unknown) {
    const next = { ...values, [key]: value };
    if (controlled === undefined) setLocal(next);
    onChange?.(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || disabled) return;
    await onSubmit?.(values);
  }

  return (
    <form
      className="step-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label={preview ? "Step preview" : "Step form"}
    >
      {preview ? (
        <p className="ui-hint" style={{ marginBottom: "1rem" }}>
          Preview — answers are not saved here.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        {fields.map((field) => {
          const inputId = `${formId}-${field.key}`;
          const errorMsg = errors?.[field.key];
          const describedBy = errorMsg ? `${field.key}-error` : undefined;
          const invalid = Boolean(errorMsg);

          switch (field.type) {
            case "text":
              return (
                <FormField
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  required={field.required}
                  errors={errors}
                  htmlFor={inputId}
                >
                  <input
                    id={inputId}
                    className="ui-input"
                    name={field.key}
                    type="text"
                    value={String(values[field.key] ?? "")}
                    required={field.required}
                    disabled={readOnly && !preview}
                    readOnly={preview}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setValue(field.key, e.target.value)
                    }
                  />
                </FormField>
              );
            case "number":
              return (
                <FormField
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  required={field.required}
                  errors={errors}
                  htmlFor={inputId}
                >
                  <input
                    id={inputId}
                    className="ui-input"
                    name={field.key}
                    type="number"
                    inputMode="decimal"
                    value={
                      values[field.key] === "" || values[field.key] === undefined
                        ? ""
                        : String(values[field.key])
                    }
                    required={field.required}
                    disabled={readOnly && !preview}
                    readOnly={preview}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setValue(field.key, "");
                        return;
                      }
                      const n = Number(raw);
                      setValue(field.key, Number.isFinite(n) ? n : raw);
                    }}
                  />
                </FormField>
              );
            case "date":
              return (
                <FormField
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  required={field.required}
                  errors={errors}
                  htmlFor={inputId}
                >
                  <input
                    id={inputId}
                    className="ui-input"
                    name={field.key}
                    type="date"
                    value={String(values[field.key] ?? "")}
                    required={field.required}
                    disabled={readOnly && !preview}
                    readOnly={preview}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setValue(field.key, e.target.value)
                    }
                  />
                </FormField>
              );
            case "confirm":
              return (
                <FormField
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  required={field.required}
                  errors={errors}
                  htmlFor={inputId}
                >
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      minHeight: "2.25rem",
                    }}
                  >
                    <input
                      id={inputId}
                      name={field.key}
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      required={field.required}
                      disabled={readOnly && !preview}
                      aria-invalid={invalid}
                      aria-describedby={describedBy}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setValue(field.key, e.target.checked)
                      }
                    />
                    <span>{field.required ? "I confirm" : "Optional confirmation"}</span>
                  </label>
                </FormField>
              );
            case "file":
              return (
                <FormField
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  required={field.required}
                  hint={
                    onUploadFile
                      ? "File uploads immediately; the document id is saved with the step."
                      : "Upload attaches a document id when the invoice step is submitted."
                  }
                  errors={errors}
                  htmlFor={inputId}
                >
                  <input
                    id={inputId}
                    className="ui-input"
                    name={field.key}
                    type="file"
                    required={field.required && !values[field.key]}
                    disabled={(readOnly && !preview) || uploadingKey === field.key}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setValue(field.key, "");
                        return;
                      }
                      if (!onUploadFile) {
                        setValue(field.key, file.name);
                        return;
                      }
                      setUploadingKey(field.key);
                      try {
                        const documentId = await onUploadFile(field.key, file);
                        setValue(field.key, documentId);
                      } catch {
                        setValue(field.key, "");
                        e.target.value = "";
                      } finally {
                        setUploadingKey(null);
                      }
                    }}
                  />
                  {uploadingKey === field.key ? (
                    <UploadProgress />
                  ) : typeof values[field.key] === "string" && values[field.key] ? (
                    <p className="ui-hint">
                      {onUploadFile
                        ? `Attached document: ${String(values[field.key]).slice(0, 8)}…`
                        : `Selected: ${String(values[field.key])}`}
                    </p>
                  ) : null}
                </FormField>
              );
            default: {
              const _exhaustive: never = field.type;
              return (
                <p key={String(_exhaustive)} className="ui-field-error">
                  Unsupported field type
                </p>
              );
            }
          }
        })}
      </div>

      {!preview ? (
        <div style={{ marginTop: "1.25rem" }}>
          <button type="submit" className="ui-btn" disabled={disabled || Boolean(uploadingKey)}>
            {submitLabel}
          </button>
        </div>
      ) : null}

      {errors?._form ? (
        <p className="ui-field-error" role="alert" style={{ marginTop: "0.75rem" }}>
          {errors._form}
        </p>
      ) : null}
    </form>
  );
}
