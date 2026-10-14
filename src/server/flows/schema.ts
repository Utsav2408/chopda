/**
 * Flow field / step Zod schemas (B4-01) and shared step-data validation (B4-02).
 * No "server-only" — unit tests and seed scripts import this module directly.
 */
import { z } from "zod";
import { err, ok, type Result } from "../kernel/result.js";
import { Validation } from "../kernel/errors.js";

/** Max fields declared on a single step. */
export const MAX_FIELDS_PER_STEP = 16;

/** Max length for a field `key`. */
export const MAX_FIELD_KEY_LENGTH = 64;

/** Max length for a field `label`. */
export const MAX_FIELD_LABEL_LENGTH = 120;

/** Max length for a flow or step name. */
export const MAX_NAME_LENGTH = 120;

/** Max length for step instructions. */
export const MAX_INSTRUCTIONS_LENGTH = 2_000;

/** Max text answer length when validating step data. */
export const MAX_TEXT_VALUE_LENGTH = 2_000;

export const FIELD_TYPES = ["file", "text", "confirm", "date", "number"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const USER_ROLES = ["admin", "builder", "viewer"] as const;
export type FlowUserRole = (typeof USER_ROLES)[number];

export const FLOW_STATUSES = ["draft", "published", "archived"] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

const fieldKeySchema = z
  .string()
  .min(1)
  .max(MAX_FIELD_KEY_LENGTH)
  .regex(/^[a-z][a-z0-9_]*$/, "key must be snake_case starting with a letter");

export const flowFieldSchema = z.object({
  key: fieldKeySchema,
  label: z.string().min(1).max(MAX_FIELD_LABEL_LENGTH),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
});

export type FlowField = z.infer<typeof flowFieldSchema>;

/**
 * Ordered list of fields for one step. Keys must be unique within the list;
 * count capped at MAX_FIELDS_PER_STEP.
 */
export const flowFieldsSchema = z
  .array(flowFieldSchema)
  .max(MAX_FIELDS_PER_STEP)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < fields.length; i++) {
      const key = fields[i]!.key;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "key"],
          message: `duplicate field key "${key}"`,
        });
      }
      seen.add(key);
    }
  });

export type FlowFields = z.infer<typeof flowFieldsSchema>;

export const flowStepInputSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  instructions: z.string().max(MAX_INSTRUCTIONS_LENGTH).nullable().optional(),
  allowedRole: z.enum(USER_ROLES),
  fields: flowFieldsSchema.default([]),
});

export type FlowStepInput = z.infer<typeof flowStepInputSchema>;

export const createDraftInputSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH),
});

export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;

export const editStepInputSchema = flowStepInputSchema.partial().extend({
  stepId: z.string().uuid(),
});

export type EditStepInput = z.infer<typeof editStepInputSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type StepDataIssue = {
  key?: string;
  message: string;
};

/**
 * Validate invoice/step answers against a step's field definitions (B4-02).
 * Rejects missing required values, wrong types, and extra keys.
 */
export function validateStepData(
  fields: FlowFields,
  data: unknown,
): Result<Record<string, unknown>, Validation> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return err(new Validation("Step data must be a JSON object"));
  }

  const record = data as Record<string, unknown>;
  const allowedKeys = new Set(fields.map((f) => f.key));
  const issues: StepDataIssue[] = [];

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      issues.push({ key, message: `Unexpected field "${key}"` });
    }
  }

  for (const field of fields) {
    const value = record[field.key];
    const missing = value === undefined || value === null;

    if (missing) {
      if (field.required) {
        issues.push({ key: field.key, message: `Missing required field "${field.key}"` });
      }
      continue;
    }

    const typeIssue = typeCheckFieldValue(field, value);
    if (typeIssue) {
      issues.push({ key: field.key, message: typeIssue });
      continue;
    }

    if (field.type === "confirm" && field.required && value !== true) {
      issues.push({
        key: field.key,
        message: `Confirmation "${field.key}" must be true`,
      });
    }
  }

  if (issues.length > 0) {
    return err(new Validation(issues.map((i) => i.message).join("; ")));
  }

  return ok(record);
}

function typeCheckFieldValue(field: FlowField, value: unknown): string | null {
  switch (field.type) {
    case "file":
      if (typeof value !== "string" || value.length === 0) {
        return `Field "${field.key}" must be a non-empty document id string`;
      }
      if (value.length > MAX_FIELD_KEY_LENGTH + 64) {
        return `Field "${field.key}" document id is too long`;
      }
      return null;
    case "text":
      if (typeof value !== "string") {
        return `Field "${field.key}" must be a string`;
      }
      if (value.length > MAX_TEXT_VALUE_LENGTH) {
        return `Field "${field.key}" exceeds max length ${MAX_TEXT_VALUE_LENGTH}`;
      }
      return null;
    case "confirm":
      if (typeof value !== "boolean") {
        return `Field "${field.key}" must be a boolean`;
      }
      return null;
    case "date":
      if (typeof value !== "string" || !ISO_DATE.test(value)) {
        return `Field "${field.key}" must be an ISO date (YYYY-MM-DD)`;
      }
      {
        const [y, m, d] = value.split("-").map(Number);
        const dt = new Date(Date.UTC(y!, m! - 1, d!));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m! - 1 || dt.getUTCDate() !== d) {
          return `Field "${field.key}" is not a valid calendar date`;
        }
      }
      return null;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return `Field "${field.key}" must be a finite number`;
      }
      return null;
    default: {
      const _exhaustive: never = field.type;
      return `Unknown field type ${_exhaustive}`;
    }
  }
}

/** Parse fields JSON from the DB; throw Validation on bad shape. */
export function parseFlowFields(raw: unknown): FlowFields {
  const parsed = flowFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Validation(`Invalid flow fields: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  }
  return parsed.data;
}
