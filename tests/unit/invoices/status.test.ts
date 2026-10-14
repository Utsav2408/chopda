import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAITING_DAYS,
  daysOpen,
  deriveInvoiceStatus,
} from "../../../src/server/invoices/status.js";

describe("invoice status derivation (B5-06)", () => {
  const opened = new Date("2026-10-01T12:00:00.000Z");

  it("returns cancelled / completed as terminal", () => {
    expect(
      deriveInvoiceStatus({
        status: "cancelled",
        dueDate: "2020-01-01",
        currentStepOpenedAt: opened,
        now: new Date("2026-10-20T00:00:00.000Z"),
      }),
    ).toBe("cancelled");

    expect(
      deriveInvoiceStatus({
        status: "completed",
        dueDate: "2020-01-01",
        currentStepOpenedAt: opened,
        now: new Date("2026-10-20T00:00:00.000Z"),
      }),
    ).toBe("completed");
  });

  it("marks overdue when today is strictly after due_date", () => {
    const recentlyOpened = new Date("2026-10-09T12:00:00.000Z");

    // Boundary: on due date → not overdue yet (and not waiting).
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: "2026-10-10",
        currentStepOpenedAt: recentlyOpened,
        now: new Date("2026-10-10T23:59:59.000Z"),
      }),
    ).toBe("open");

    // Next UTC day → overdue.
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: "2026-10-10",
        currentStepOpenedAt: recentlyOpened,
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe("overdue");
  });

  it("marks waiting when days open exceeds threshold (default 3)", () => {
    expect(DEFAULT_WAITING_DAYS).toBe(3);

    // Opened Oct 1; on Oct 4 daysOpen=3 → not waiting yet (must be > 3).
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: null,
        currentStepOpenedAt: opened,
        now: new Date("2026-10-04T15:00:00.000Z"),
      }),
    ).toBe("open");

    // Oct 5 → daysOpen=4 → waiting.
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: null,
        currentStepOpenedAt: opened,
        now: new Date("2026-10-05T00:00:00.000Z"),
      }),
    ).toBe("waiting");
  });

  it("respects a custom waitingDays threshold", () => {
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: null,
        currentStepOpenedAt: opened,
        now: new Date("2026-10-03T00:00:00.000Z"),
        waitingDays: 1,
      }),
    ).toBe("waiting");
  });

  it("overdue wins over waiting", () => {
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: "2026-09-01",
        currentStepOpenedAt: opened,
        now: new Date("2026-10-20T00:00:00.000Z"),
      }),
    ).toBe("overdue");
  });

  it("daysOpen counts whole UTC calendar days", () => {
    expect(daysOpen(opened, new Date("2026-10-01T23:00:00.000Z"))).toBe(0);
    expect(daysOpen(opened, new Date("2026-10-02T00:00:00.000Z"))).toBe(1);
    expect(daysOpen(opened, new Date("2026-10-04T00:00:00.000Z"))).toBe(3);
  });
});
