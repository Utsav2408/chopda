import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/jobs", () => ({
  runPurge: vi.fn(async () => ({
    dryRun: false,
    retentionDays: 30,
    invoicesConsidered: 0,
    invoicesPurged: 0,
    documentsRemoved: 0,
    filesDeleted: 0,
    filesSkippedSharedKey: 0,
  })),
}));

vi.mock("@/server/reminders", () => ({
  runCronSweep: vi.fn(async () => ({ cleared: 0 })),
}));

import { GET as purgeGet } from "../../../src/app/api/cron/purge/route.js";
import { GET as remindersGet } from "../../../src/app/api/cron/reminders/route.js";
import { runPurge } from "@/server/jobs";
import { runCronSweep } from "@/server/reminders";

const SECRET = "unit-test-cron-secret";

describe("cron routes (B7-10)", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(runPurge).mockClear();
    vi.mocked(runCronSweep).mockClear();
  });

  it("purge returns 401 without secret", async () => {
    const res = await purgeGet(new Request("http://localhost/api/cron/purge"));
    expect(res.status).toBe(401);
    expect(runPurge).not.toHaveBeenCalled();
  });

  it("purge runs with Bearer secret", async () => {
    const res = await purgeGet(
      new Request("http://localhost/api/cron/purge", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(runPurge).toHaveBeenCalledOnce();
  });

  it("reminders returns 401 without secret", async () => {
    const res = await remindersGet(new Request("http://localhost/api/cron/reminders"));
    expect(res.status).toBe(401);
    expect(runCronSweep).not.toHaveBeenCalled();
  });

  it("reminders runs with x-cron-secret", async () => {
    const res = await remindersGet(
      new Request("http://localhost/api/cron/reminders", {
        headers: { "x-cron-secret": SECRET },
      }),
    );
    expect(res.status).toBe(200);
    expect(runCronSweep).toHaveBeenCalledOnce();
  });
});
