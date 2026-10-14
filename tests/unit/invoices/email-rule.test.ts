import { describe, expect, it } from "vitest";
import {
  assertManualEmailRule,
  stepRequiresEmailSent,
} from "../../../src/server/invoices/email-rule.js";
import { Validation } from "../../../src/server/kernel/errors.js";
import type { FlowFields } from "../../../src/server/flows/schema.js";

const courierFields: FlowFields = [
  { key: "courier", label: "Courier", type: "text", required: true },
  { key: "email_sent", label: "Email sent", type: "confirm", required: true },
  { key: "email_proof", label: "Proof", type: "file", required: false },
];

describe("manual-email rule (B5-08)", () => {
  it("detects email_sent on courier-like steps", () => {
    expect(stepRequiresEmailSent(courierFields)).toBe(true);
    expect(
      stepRequiresEmailSent([{ key: "raised", label: "R", type: "confirm", required: true }]),
    ).toBe(false);
  });

  it("refuses completion without email_sent=true", () => {
    expect(() =>
      assertManualEmailRule(courierFields, { courier: "BlueDart", email_sent: false }),
    ).toThrow(Validation);
    expect(() => assertManualEmailRule(courierFields, { courier: "BlueDart" })).toThrow(Validation);
  });

  it("allows completion when email_sent is true (proof optional)", () => {
    expect(() =>
      assertManualEmailRule(courierFields, { courier: "BlueDart", email_sent: true }),
    ).not.toThrow();
  });

  it("is a no-op when step has no email_sent field", () => {
    expect(() =>
      assertManualEmailRule([{ key: "raised", label: "R", type: "confirm", required: true }], {
        raised: true,
      }),
    ).not.toThrow();
  });
});
