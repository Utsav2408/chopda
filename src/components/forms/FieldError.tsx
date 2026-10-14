import type { FieldErrors } from "./map-field-errors";

export type FieldErrorProps = {
  name: string;
  errors?: FieldErrors | null;
  id?: string;
};

export function FieldError({ name, errors, id }: FieldErrorProps) {
  const message = errors?.[name];
  if (!message) return null;
  return (
    <p className="ui-field-error" id={id} role="alert">
      {message}
    </p>
  );
}
