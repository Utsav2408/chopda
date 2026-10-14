import { describe, expect, it } from "vitest";
import {
  handleListInvoices,
  handleSoftDeleteInvoice,
  handleDashboardCounts,
  handleReminders,
} from "../../../src/server/invoices/handlers.js";

describe("B7 handlers auth gates (B7-12)", () => {
  it("list denies signed-out", async () => {
    const result = await handleListInvoices(null, { tab: "all" });
    expect(result.status).toBe(401);
  });

  it("softDelete denies builder", async () => {
    const result = await handleSoftDeleteInvoice(
      { userId: "u", role: "builder", requestId: "r" },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result.status).toBe(404); // Forbidden mapped to 404
  });

  it("dashboard counts denies signed-out", async () => {
    const result = await handleDashboardCounts(null);
    expect(result.status).toBe(401);
  });

  it("reminders denies signed-out", async () => {
    const result = await handleReminders(null);
    expect(result.status).toBe(401);
  });

  it("list rejects invalid tab", async () => {
    const result = await handleListInvoices(
      { userId: "u", role: "viewer", requestId: "r" },
      { tab: "nope" },
    );
    expect(result.status).toBe(400);
  });
});
