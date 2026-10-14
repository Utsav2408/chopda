import { describe, expect, it } from "vitest";
import { reminderKey } from "../../../src/server/reminders/service.js";
import { deriveInvoiceStatus, daysOpen } from "../../../src/server/invoices/status.js";
import { DUE_SOON_DAYS } from "../../../src/server/invoices/constants.js";

describe("reminders.compute rules (B7-06)", () => {
  it("reminderKey is kind:invoiceId", () => {
    expect(reminderKey("waiting", "inv-1")).toBe("waiting:inv-1");
    expect(reminderKey("dueSoon", "inv-2")).toBe("dueSoon:inv-2");
  });

  it("waiting reminder appears when step open > N days", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const opened = new Date("2026-10-06T12:00:00.000Z"); // 4 days open
    expect(daysOpen(opened, now)).toBe(4);
    expect(
      deriveInvoiceStatus({
        status: "open",
        dueDate: null,
        currentStepOpenedAt: opened,
        waitingDays: 3,
        now,
      }),
    ).toBe("waiting");
  });

  it("waiting clears when status is completed", () => {
    expect(
      deriveInvoiceStatus({
        status: "completed",
        dueDate: "2026-10-01",
        currentStepOpenedAt: new Date("2026-09-01T00:00:00.000Z"),
        now: new Date("2026-10-10T00:00:00.000Z"),
      }),
    ).toBe("completed");
  });

  it("due soon window default is 7 days", () => {
    expect(DUE_SOON_DAYS).toBe(7);
  });
});
