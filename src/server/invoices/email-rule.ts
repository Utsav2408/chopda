/**
 * Manual-email rule (B5-08): courier (and Standard email) steps that declare
 * an `email_sent` confirm field require it to be true. Proof uploads remain
 * optional via the field's `required: false`.
 *
 * `validateStepData` already enforces required confirms; this helper makes the
 * product rule explicit and catches incomplete field definitions.
 */
import type { FlowFields } from "../flows/schema.js";
import { Validation } from "../kernel/errors.js";

export const EMAIL_SENT_FIELD_KEY = "email_sent" as const;

/**
 * If the step defines `email_sent` as a confirm field, require `data.email_sent === true`.
 * No-op when the step has no such field.
 */
export function assertManualEmailRule(fields: FlowFields, data: Record<string, unknown>): void {
  const emailField = fields.find((f) => f.key === EMAIL_SENT_FIELD_KEY);
  if (!emailField) return;

  if (emailField.type !== "confirm") {
    throw new Validation(
      `Field "${EMAIL_SENT_FIELD_KEY}" must be type confirm for the manual-email rule`,
    );
  }

  if (data[EMAIL_SENT_FIELD_KEY] !== true) {
    throw new Validation(
      `Courier/email step requires "${EMAIL_SENT_FIELD_KEY}" confirmation to be true`,
    );
  }
}

/** True when step fields include the required email_sent confirm. */
export function stepRequiresEmailSent(fields: FlowFields): boolean {
  return fields.some((f) => f.key === EMAIL_SENT_FIELD_KEY && f.type === "confirm");
}
