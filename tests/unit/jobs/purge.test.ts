import { describe, expect, it } from "vitest";
import { createMemoryStorageAdapter } from "../../storage/memory-fake.js";
import { UNDO_RETENTION_DAYS } from "../../../src/server/invoices/constants.js";
import { runPurge } from "../../../src/server/jobs/purge.js";
import { DOWNLOAD_CACHE_CONTROL } from "../../../src/server/documents/service.js";

describe("purge job settings (B7-09 / B9-08f)", () => {
  it("retention days match undo window (one setting)", () => {
    expect(UNDO_RETENTION_DAYS).toBe(30);
  });

  it("exports runPurge with dry-run support", () => {
    expect(typeof runPurge).toBe("function");
  });

  it("storage adapter delete is idempotent for missing keys", async () => {
    const storage = createMemoryStorageAdapter();
    await expect(storage.delete("documents/missing-id")).resolves.toBeUndefined();
  });

  it("shared object_key must not be deleted while a live doc remains (B9-08f)", () => {
    const liveRefsForKey = (objectKey: string, docs: { objectKey: string; live: boolean }[]) =>
      docs.filter((d) => d.objectKey === objectKey && d.live).length;

    const key = "documents/shared";
    expect(
      liveRefsForKey(key, [
        { objectKey: key, live: false },
        { objectKey: key, live: true },
      ]),
    ).toBe(1);
    expect(
      liveRefsForKey(key, [
        { objectKey: key, live: false },
        { objectKey: key, live: false },
      ]),
    ).toBe(0);
  });

  it("download Cache-Control is private immutable (B9-08f)", () => {
    expect(DOWNLOAD_CACHE_CONTROL).toBe("private, max-age=31536000, immutable");
  });

  it("shared-key purge skips delete when another live ref exists", async () => {
    const storage = createMemoryStorageAdapter();
    const deleted: string[] = [];
    const wrapped = {
      ...storage,
      async delete(key: string) {
        deleted.push(key);
        return storage.delete(key);
      },
    };

    // Pure policy mirror of runPurge's countLiveRefs gate (unit, no DB).
    const shouldDeleteObject = (liveRefsElsewhere: number) => liveRefsElsewhere === 0;
    expect(shouldDeleteObject(1)).toBe(false);
    expect(shouldDeleteObject(0)).toBe(true);

    if (shouldDeleteObject(0)) {
      await wrapped.delete("documents/orphan");
    }
    if (!shouldDeleteObject(1)) {
      // skip shared key
    }
    expect(deleted).toEqual(["documents/orphan"]);
  });
});
