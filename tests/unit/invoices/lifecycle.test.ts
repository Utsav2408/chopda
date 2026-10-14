import { describe, expect, it } from "vitest";
import { daysLeftUntilPurge, UNDO_RETENTION_DAYS } from "../../../src/server/invoices/lifecycle.js";

describe("invoice undo window (B7-08)", () => {
  const deletedAt = new Date("2026-01-01T00:00:00.000Z");

  it("day 29 still has days left", () => {
    const now = new Date("2026-01-30T00:00:00.000Z"); // +29 days
    expect(daysLeftUntilPurge(deletedAt, now, UNDO_RETENTION_DAYS)).toBe(1);
  });

  it("day 31 has no days left (undo refused)", () => {
    const now = new Date("2026-02-01T00:00:00.000Z"); // +31 days
    expect(daysLeftUntilPurge(deletedAt, now, UNDO_RETENTION_DAYS)).toBeLessThanOrEqual(0);
  });

  it("uses the single retention setting", () => {
    expect(UNDO_RETENTION_DAYS).toBe(30);
  });
});
