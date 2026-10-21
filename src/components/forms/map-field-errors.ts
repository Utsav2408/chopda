/**
 * Map Zod issues and server Validation payloads into field-keyed messages (U1-04).
 */
import type { ZodError, ZodIssue } from "zod";

export type FieldErrors = Record<string, string>;

export type ServerValidationBody = {
  error?: string;
  fieldErrors?: Record<string, string | string[]>;
  issues?: Array<{ path?: Array<string | number>; message?: string; key?: string }>;
};

function issuePathKey(issue: ZodIssue): string {
  const parts = issue.path.filter((p) => typeof p === "string" || typeof p === "number");
  if (parts.length === 0) return "_form";
  return parts.map(String).join(".");
}

/** Prefer the first message per field key. */
export function fieldErrorsFromZod(error: Pick<ZodError, "issues">): FieldErrors {
  return fieldErrorsFromZodIssues(error.issues);
}

function fieldErrorsFromZodIssues(issues: ZodIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issuePathKey(issue);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Map a JSON error body from route handlers / actions.
 * Supports `{ error }`, `{ fieldErrors }`, and `{ issues: [{ key|path, message }] }`.
 */
export function fieldErrorsFromServer(body: unknown, fallbackFormKey = "_form"): FieldErrors {
  if (!body || typeof body !== "object") {
    return { [fallbackFormKey]: "Request failed" };
  }

  const data = body as ServerValidationBody;
  const out: FieldErrors = {};

  if (data.fieldErrors && typeof data.fieldErrors === "object") {
    for (const [key, value] of Object.entries(data.fieldErrors)) {
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string" && message.length > 0 && !out[key]) {
        out[key] = message;
      }
    }
  }

  if (Array.isArray(data.issues)) {
    for (const issue of data.issues) {
      const key =
        (typeof issue.key === "string" && issue.key) ||
        (Array.isArray(issue.path) && issue.path.length > 0
          ? issue.path.map(String).join(".")
          : fallbackFormKey);
      const message = typeof issue.message === "string" ? issue.message : undefined;
      if (message && !out[key]) out[key] = message;
    }
  }

  if (typeof data.error === "string" && data.error.length > 0 && Object.keys(out).length === 0) {
    out[fallbackFormKey] = data.error;
  }

  if (Object.keys(out).length === 0) {
    out[fallbackFormKey] = "Validation failed";
  }

  return out;
}
