/**
 * Valid / invalid field-list fixtures for B4-01.
 */
import type { FlowField } from "../../../src/server/flows/schema.js";
import {
  MAX_FIELD_KEY_LENGTH,
  MAX_FIELD_LABEL_LENGTH,
  MAX_FIELDS_PER_STEP,
} from "../../../src/server/flows/schema.js";

export const validMinimalFields: FlowField[] = [];

export const validMixedFields: FlowField[] = [
  { key: "challan", label: "Delivery challan", type: "file", required: true },
  { key: "courier", label: "Courier name", type: "text", required: true },
  { key: "email_sent", label: "I have sent the email", type: "confirm", required: true },
  { key: "email_proof", label: "Email proof", type: "file", required: false },
  { key: "due_date", label: "Due date", type: "date", required: false },
  { key: "qty", label: "Quantity", type: "number", required: false },
];

export const invalidDuplicateKeys: FlowField[] = [
  { key: "file_a", label: "A", type: "file", required: true },
  { key: "file_a", label: "A again", type: "file", required: false },
];

export const invalidBadKey: FlowField[] = [
  { key: "Bad-Key", label: "Nope", type: "text", required: true },
];

export const invalidEmptyKey: FlowField[] = [
  { key: "", label: "Empty", type: "text", required: true },
];

export const invalidUnknownType = [
  { key: "x", label: "X", type: "email", required: true },
] as unknown as FlowField[];

export const invalidTooManyFields: FlowField[] = Array.from(
  { length: MAX_FIELDS_PER_STEP + 1 },
  (_, i) => ({
    key: `f_${i}`,
    label: `Field ${i}`,
    type: "text" as const,
    required: false,
  }),
);

export const invalidKeyTooLong: FlowField[] = [
  {
    key: "k".repeat(MAX_FIELD_KEY_LENGTH + 1),
    label: "Long key",
    type: "text",
    required: false,
  },
];

export const invalidLabelTooLong: FlowField[] = [
  {
    key: "ok",
    label: "L".repeat(MAX_FIELD_LABEL_LENGTH + 1),
    type: "text",
    required: false,
  },
];

export const invalidMissingRequiredProp = [
  { key: "a", label: "A", type: "text" },
] as unknown as FlowField[];
