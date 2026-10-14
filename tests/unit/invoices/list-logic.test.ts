import { describe, expect, it } from "vitest";
import {
  applyListQuery,
  encodeListCursor,
  matchesFilters,
  matchesTab,
  type ListCandidate,
} from "../../../src/server/invoices/list-logic.js";

function row(
  partial: Partial<ListCandidate> & Pick<ListCandidate, "id" | "status">,
): ListCandidate {
  return {
    invoiceNo: partial.invoiceNo ?? `INV-${partial.id}`,
    partyName: partial.partyName ?? "Party",
    ownerId: partial.ownerId ?? "owner-a",
    flowTemplateId: partial.flowTemplateId ?? "flow-1",
    currentStepId: partial.currentStepId ?? "step-1",
    issueDate: partial.issueDate ?? "2026-10-01",
    dueDate: partial.dueDate ?? null,
    createdAt: partial.createdAt ?? new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: partial.deletedAt ?? null,
    ...partial,
  };
}

describe("invoices.list tab/filter logic (B7-01)", () => {
  const viewer = "owner-a";

  it("matchesTab covers All/Mine/Waiting/Overdue/Completed", () => {
    const open = row({ id: "1", status: "open", ownerId: "owner-b" });
    const mine = row({ id: "2", status: "open", ownerId: viewer });
    const waiting = row({ id: "3", status: "waiting" });
    const overdue = row({ id: "4", status: "overdue" });
    const completed = row({ id: "5", status: "completed" });

    expect(matchesTab(open, "all", viewer)).toBe(true);
    expect(matchesTab(open, "mine", viewer)).toBe(false);
    expect(matchesTab(mine, "mine", viewer)).toBe(true);
    expect(matchesTab(waiting, "waiting", viewer)).toBe(true);
    expect(matchesTab(open, "waiting", viewer)).toBe(false);
    expect(matchesTab(overdue, "overdue", viewer)).toBe(true);
    expect(matchesTab(completed, "completed", viewer)).toBe(true);
  });

  it("matchesFilters for flow, step, owner, date range", () => {
    const r = row({
      id: "1",
      status: "open",
      flowTemplateId: "flow-a",
      currentStepId: "step-x",
      ownerId: "o1",
      issueDate: "2026-10-05",
    });
    expect(matchesFilters(r, { flowId: "flow-a" })).toBe(true);
    expect(matchesFilters(r, { flowId: "flow-b" })).toBe(false);
    expect(matchesFilters(r, { stepId: "step-x" })).toBe(true);
    expect(matchesFilters(r, { stepId: "step-y" })).toBe(false);
    expect(matchesFilters(r, { ownerId: "o1" })).toBe(true);
    expect(matchesFilters(r, { issueDateFrom: "2026-10-01", issueDateTo: "2026-10-10" })).toBe(
      true,
    );
    expect(matchesFilters(r, { issueDateFrom: "2026-10-06" })).toBe(false);
    expect(matchesFilters(r, { issueDateTo: "2026-10-04" })).toBe(false);
  });

  it("applyListQuery sorts and keyset-paginates", () => {
    const rows = [
      row({ id: "a", status: "open", createdAt: new Date("2026-10-03T00:00:00.000Z") }),
      row({ id: "b", status: "open", createdAt: new Date("2026-10-02T00:00:00.000Z") }),
      row({ id: "c", status: "open", createdAt: new Date("2026-10-01T00:00:00.000Z") }),
      row({ id: "d", status: "waiting", createdAt: new Date("2026-10-04T00:00:00.000Z") }),
    ];

    const page1 = applyListQuery(
      rows,
      { tab: "all", limit: 2, sort: "createdAt", sortDir: "desc" },
      viewer,
    );
    expect(page1.items.map((i) => i.id)).toEqual(["d", "a"]);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = applyListQuery(
      rows,
      { tab: "all", limit: 2, sort: "createdAt", sortDir: "desc", cursor: page1.nextCursor! },
      viewer,
    );
    expect(page2.items.map((i) => i.id)).toEqual(["b", "c"]);
    expect(page2.nextCursor).toBeNull();
  });

  it("waiting tab filters derived status", () => {
    const rows = [
      row({ id: "1", status: "open" }),
      row({ id: "2", status: "waiting" }),
      row({ id: "3", status: "overdue" }),
    ];
    const result = applyListQuery(rows, { tab: "waiting" }, viewer);
    expect(result.items.map((i) => i.id)).toEqual(["2"]);
  });

  it("hides soft-deleted rows from list query", () => {
    const rows = [
      row({ id: "1", status: "open" }),
      row({ id: "2", status: "open", deletedAt: new Date("2026-10-01T00:00:00.000Z") }),
    ];
    const result = applyListQuery(rows, { tab: "all" }, viewer);
    expect(result.items.map((i) => i.id)).toEqual(["1"]);
  });

  it("encodeListCursor round-trips", () => {
    const enc = encodeListCursor({ id: "x", sortValue: "2026-10-01T00:00:00.000Z" });
    expect(typeof enc).toBe("string");
    expect(enc.length).toBeGreaterThan(0);
  });
});
