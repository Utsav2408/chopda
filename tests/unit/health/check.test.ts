import { describe, expect, it, beforeEach } from "vitest";
import { check, clearStorageHealthCache } from "../../../src/server/health/service.js";
import { createMemoryStorageAdapter } from "../../storage/memory-fake.js";
import type { StorageAdapter } from "../../../src/server/storage/index.js";

describe("health.check (B7-11)", () => {
  beforeEach(() => {
    clearStorageHealthCache();
  });

  it("reports backupStatus none and caches storage health", async () => {
    let probes = 0;
    const storage: StorageAdapter = {
      ...createMemoryStorageAdapter(),
      async healthCheck() {
        probes += 1;
      },
    };

    // DB may be unavailable in unit env — still returns a structured result.
    const first = await check({
      storage,
      storageCacheTtlMs: 60_000,
      now: new Date("2026-10-14T00:00:00.000Z"),
    });
    expect(first.backupStatus).toBe("none");
    expect(first.storageProvider).toBeTruthy();
    expect(first.service).toBe("chopda");
    expect(first.storage.ok).toBe(true);
    expect(first.storageUsedAlert).toBe(false);
    expect(probes).toBe(1);

    const second = await check({
      storage,
      storageCacheTtlMs: 60_000,
      now: new Date("2026-10-14T00:00:30.000Z"),
    });
    expect(second.storage.cached).toBe(true);
    expect(probes).toBe(1);
  });

  it("turns storage ok false when healthCheck throws", async () => {
    const storage: StorageAdapter = {
      ...createMemoryStorageAdapter(),
      async healthCheck() {
        throw new Error("unreachable");
      },
    };
    const result = await check({
      storage,
      storageCacheTtlMs: 60_000,
      now: new Date("2026-10-14T00:00:00.000Z"),
    });
    expect(result.storage.ok).toBe(false);
    expect(result.status === "degraded" || result.status === "error").toBe(true);
  });
});
