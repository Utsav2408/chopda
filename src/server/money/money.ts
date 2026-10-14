/**
 * Money helpers (B5-01): rupees string <-> paise bigint.
 * No floating-point arithmetic — amounts must round-trip exactly.
 */
import { Validation } from "../kernel/errors.js";

/** Max whole-rupee digits we accept (keeps bigint conversions practical). */
const MAX_RUPEE_DIGITS = 15;

const RUPEES_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

/**
 * Parse a rupees decimal string into paise (bigint).
 * Rejects floats, scientific notation, >2 decimal places, negatives, and blanks.
 */
export function rupeesToPaise(rupees: string): bigint {
  if (typeof rupees !== "string") {
    throw new Validation("Amount must be a string in rupees");
  }
  const trimmed = rupees.trim();
  if (trimmed.length === 0) {
    throw new Validation("Amount is required");
  }
  if (trimmed.includes("e") || trimmed.includes("E") || trimmed.includes("+")) {
    throw new Validation("Amount must be a plain decimal string (no scientific notation)");
  }
  if (!RUPEES_PATTERN.test(trimmed)) {
    throw new Validation(
      "Amount must be a non-negative rupees string with at most 2 decimal places",
    );
  }

  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (wholePart!.length > MAX_RUPEE_DIGITS) {
    throw new Validation(`Amount whole-rupee part exceeds ${MAX_RUPEE_DIGITS} digits`);
  }

  const whole = BigInt(wholePart!);
  const fracPadded = (fracPart + "00").slice(0, 2);
  const frac = BigInt(fracPadded);
  return whole * 100n + frac;
}

/**
 * Format paise bigint as a rupees string with exactly 2 decimal places
 * (e.g. `100` → `"1.00"`, `0` → `"0.00"`).
 */
export function paiseToRupees(paise: bigint): string {
  if (typeof paise !== "bigint") {
    throw new Validation("Paise amount must be a bigint");
  }
  if (paise < 0n) {
    throw new Validation("Paise amount must be non-negative");
  }
  const whole = paise / 100n;
  const frac = paise % 100n;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

/** True when `value` is a string that `rupeesToPaise` would accept. */
export function isValidRupeesString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    rupeesToPaise(value);
    return true;
  } catch {
    return false;
  }
}
