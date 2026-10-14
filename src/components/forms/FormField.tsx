import type { ReactNode } from "react";
import { FieldError } from "./FieldError";
import type { FieldErrors } from "./map-field-errors";

export type FormFieldProps = {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  errors?: FieldErrors | null;
  children: ReactNode;
  htmlFor?: string;
};

export function FormField({
  name,
  label,
  required,
  hint,
  errors,
  children,
  htmlFor,
}: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = hint ? `${name}-hint` : undefined;
  const hasError = Boolean(errors?.[name]);

  return (
    <div className="ui-form-field" data-invalid={hasError ? "true" : undefined}>
      <label className="ui-label" htmlFor={htmlFor ?? name}>
        {label}
        {required ? (
          <span aria-hidden="true"> *</span>
        ) : (
          <span className="sr-only"> (optional)</span>
        )}
      </label>
      {children}
      {hint && !hasError ? (
        <p className="ui-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <FieldError name={name} errors={errors} id={errorId} />
    </div>
  );
}
