import { describe, expect, it } from "vitest";
import { flowFieldsSchema, validateStepData } from "../../../src/server/flows/schema.js";
import { isErr, isOk } from "../../../src/server/kernel/result.js";
import {
  invalidBadKey,
  invalidDuplicateKeys,
  invalidEmptyKey,
  invalidKeyTooLong,
  invalidLabelTooLong,
  invalidMissingRequiredProp,
  invalidTooManyFields,
  invalidUnknownType,
  validMinimalFields,
  validMixedFields,
} from "./schema.fixtures.js";

describe("flow fields schema (B4-01)", () => {
  it("accepts empty and mixed valid field lists", () => {
    expect(flowFieldsSchema.safeParse(validMinimalFields).success).toBe(true);
    expect(flowFieldsSchema.safeParse(validMixedFields).success).toBe(true);
  });

  it("rejects duplicate keys", () => {
    const result = flowFieldsSchema.safeParse(invalidDuplicateKeys);
    expect(result.success).toBe(false);
  });

  it("rejects bad key shapes and empty keys", () => {
    expect(flowFieldsSchema.safeParse(invalidBadKey).success).toBe(false);
    expect(flowFieldsSchema.safeParse(invalidEmptyKey).success).toBe(false);
  });

  it("rejects unknown types and missing required props", () => {
    expect(flowFieldsSchema.safeParse(invalidUnknownType).success).toBe(false);
    expect(flowFieldsSchema.safeParse(invalidMissingRequiredProp).success).toBe(false);
  });

  it("rejects over max field count and overlong key/label", () => {
    expect(flowFieldsSchema.safeParse(invalidTooManyFields).success).toBe(false);
    expect(flowFieldsSchema.safeParse(invalidKeyTooLong).success).toBe(false);
    expect(flowFieldsSchema.safeParse(invalidLabelTooLong).success).toBe(false);
  });
});

describe("validateStepData (B4-02)", () => {
  const fields = validMixedFields;

  it("accepts a complete valid payload", () => {
    const result = validateStepData(fields, {
      challan: "doc:aaa",
      courier: "BlueDart",
      email_sent: true,
      email_proof: "doc:bbb",
      due_date: "2026-10-14",
      qty: 2,
    });
    expect(isOk(result)).toBe(true);
  });

  it("allows omitting optional fields", () => {
    const result = validateStepData(fields, {
      challan: "doc:aaa",
      courier: "BlueDart",
      email_sent: true,
    });
    expect(isOk(result)).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = validateStepData(fields, { courier: "X", email_sent: true });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/challan/i);
    }
  });

  it("rejects wrong types", () => {
    const result = validateStepData(fields, {
      challan: "doc:aaa",
      courier: 12,
      email_sent: true,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/courier/i);
    }
  });

  it("rejects extra keys", () => {
    const result = validateStepData(fields, {
      challan: "doc:aaa",
      courier: "BlueDart",
      email_sent: true,
      surprise: true,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/surprise/i);
    }
  });

  it("rejects non-object data", () => {
    expect(isErr(validateStepData(fields, null))).toBe(true);
    expect(isErr(validateStepData(fields, []))).toBe(true);
    expect(isErr(validateStepData(fields, "x"))).toBe(true);
  });

  it("requires confirm=true when the confirm field is required", () => {
    const result = validateStepData(fields, {
      challan: "doc:aaa",
      courier: "BlueDart",
      email_sent: false,
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid dates and non-finite numbers", () => {
    expect(
      isErr(
        validateStepData(fields, {
          challan: "doc:aaa",
          courier: "BlueDart",
          email_sent: true,
          due_date: "2026-13-40",
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        validateStepData(fields, {
          challan: "doc:aaa",
          courier: "BlueDart",
          email_sent: true,
          qty: Number.NaN,
        }),
      ),
    ).toBe(true);
  });
});
