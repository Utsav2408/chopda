import { describe, expect, it } from "vitest";
import {
  addBankAccountSchema,
  IFSC_REGEX,
  panSchema,
  updateCompanyProfileSchema,
} from "../../../src/server/company/schema.js";

describe("company schemas (B8-01..02)", () => {
  it("accepts valid IFSC (4 letters, 0, 6 alnum)", () => {
    expect(IFSC_REGEX.test("SBIN0001234")).toBe(true);
    expect(IFSC_REGEX.test("HDFC000ABCD")).toBe(true);
    const parsed = addBankAccountSchema.parse({
      label: "Ops",
      bankName: "State Bank",
      accountHolder: "Chopda Pvt Ltd",
      accountNumber: "1234567890",
      ifsc: "sbin0001234",
    });
    expect(parsed.ifsc).toBe("SBIN0001234");
  });

  it("rejects malformed IFSC", () => {
    expect(IFSC_REGEX.test("SBIN1001234")).toBe(false);
    expect(IFSC_REGEX.test("SB1N0001234")).toBe(false);
    expect(IFSC_REGEX.test("SBIN000123")).toBe(false);
    expect(() =>
      addBankAccountSchema.parse({
        label: "Ops",
        bankName: "Bank",
        accountHolder: "Holder",
        accountNumber: "123",
        ifsc: "BAD",
      }),
    ).toThrow();
  });

  it("accepts valid PAN and uppercases", () => {
    expect(panSchema.parse("abcde1234f")).toBe("ABCDE1234F");
  });

  it("rejects invalid PAN", () => {
    expect(() => panSchema.parse("ABCDE12345")).toThrow();
    expect(() => panSchema.parse("ABCD1234F")).toThrow();
  });

  it("update profile accepts gstin plain and optional pan", () => {
    const parsed = updateCompanyProfileSchema.parse({
      legalName: "Chopda Trading",
      gstin: "22AAAAA0000A1Z5",
      pan: "ABCDE1234F",
    });
    expect(parsed.gstin).toBe("22AAAAA0000A1Z5");
    expect(parsed.pan).toBe("ABCDE1234F");
  });
});
