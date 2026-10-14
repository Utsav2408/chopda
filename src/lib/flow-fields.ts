/**
 * Shared flow step field shape for UI (mirrors `flowFieldSchema` / api-contract).
 * Kept out of `@/server` so client components can import freely.
 */

export const FIELD_TYPES = ["file", "text", "confirm", "date", "number"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type StepField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
};

export type StepFieldValues = Record<string, unknown>;
