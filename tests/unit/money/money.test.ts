import { describe, expect, it } from "vitest";
import { Validation } from "../../../src/server/kernel/errors.js";
import {
  isValidRupeesString,
  paiseToRupees,
  rupeesToPaise,
} from "../../../src/server/money/money.js";

describe("money utils (B5-01)", () => {
  it("converts common rupees strings to paise without floats", () => {
    expect(rupeesToPaise("0")).toBe(0n);
    expect(rupeesToPaise("0.00")).toBe(0n);
    expect(rupeesToPaise("1")).toBe(100n);
    expect(rupeesToPaise("1.5")).toBe(150n);
    expect(rupeesToPaise("1.50")).toBe(150n);
    expect(rupeesToPaise("10.01")).toBe(1001n);
    expect(rupeesToPaise("999999.99")).toBe(99999999n);
  });

  it("formats paise back to rupees with exactly 2 decimals", () => {
    expect(paiseToRupees(0n)).toBe("0.00");
    expect(paiseToRupees(1n)).toBe("0.01");
    expect(paiseToRupees(100n)).toBe("1.00");
    expect(paiseToRupees(150n)).toBe("1.50");
    expect(paiseToRupees(1001n)).toBe("10.01");
  });

  it("rejects >2 decimals, negatives, blanks, and scientific notation", () => {
    expect(() => rupeesToPaise("1.001")).toThrow(Validation);
    expect(() => rupeesToPaise("-1")).toThrow(Validation);
    expect(() => rupeesToPaise("")).toThrow(Validation);
    expect(() => rupeesToPaise("  ")).toThrow(Validation);
    expect(() => rupeesToPaise("1e2")).toThrow(Validation);
    expect(() => rupeesToPaise("1.2.3")).toThrow(Validation);
    expect(() => rupeesToPaise("01.00")).toThrow(Validation);
    expect(() => rupeesToPaise(".5")).toThrow(Validation);
  });

  it("rejects number inputs (no floats)", () => {
    expect(() => rupeesToPaise(1.5 as unknown as string)).toThrow(Validation);
    expect(() => paiseToRupees(100 as unknown as bigint)).toThrow(Validation);
    expect(() => paiseToRupees(-1n)).toThrow(Validation);
  });

  it("isValidRupeesString mirrors parse success", () => {
    expect(isValidRupeesString("12.34")).toBe(true);
    expect(isValidRupeesString("12.345")).toBe(false);
    expect(isValidRupeesString(12.34)).toBe(false);
  });

  it("round-trips exactly for a property sample of paise values", () => {
    // Deterministic property-style sweep — no floating-point intermediates.
    const samples: bigint[] = [0n, 1n, 99n, 100n, 101n, 10_000n, 12_345_678n];
    for (let i = 0n; i < 500n; i++) {
      samples.push(i * 17n + 3n);
    }
    for (const paise of samples) {
      const rupees = paiseToRupees(paise);
      expect(rupeesToPaise(rupees)).toBe(paise);
    }
  });

  it("round-trips exactly for valid rupees fixtures", () => {
    const fixtures = ["0", "0.01", "0.10", "1", "1.00", "1.5", "42.42", "1000000.99"];
    for (const r of fixtures) {
      const paise = rupeesToPaise(r);
      expect(rupeesToPaise(paiseToRupees(paise))).toBe(paise);
    }
  });
});
