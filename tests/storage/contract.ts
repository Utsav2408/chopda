import { describe, expect, it } from "vitest";
import type { Readable } from "node:stream";
import type { StorageAdapter } from "../../src/server/storage/index.js";

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Shared StorageAdapter contract (B6-02). Every adapter (local, R2, in-memory
 * fake) must pass this suite.
 */
export function defineStorageContractSuite(
  label: string,
  createAdapter: () => StorageAdapter | Promise<StorageAdapter>,
): void {
  describe(`StorageAdapter contract (${label})`, () => {
    const key = `contract-${label.replace(/\s+/g, "-")}-doc`;

    it("put → exists → getStream round-trips bytes", async () => {
      const adapter = await createAdapter();
      const payload = Buffer.from(`hello ${label} ${Date.now()}`, "utf8");

      await adapter.put(key, payload, { contentType: "text/plain" });
      expect(await adapter.exists(key)).toBe(true);

      const stream = await adapter.getStream(key);
      const roundTrip = await readAll(stream);
      expect(roundTrip.equals(payload)).toBe(true);
    });

    it("delete removes the object", async () => {
      const adapter = await createAdapter();
      const deleteKey = `${key}-delete`;
      await adapter.put(deleteKey, "to-delete");
      expect(await adapter.exists(deleteKey)).toBe(true);

      await adapter.delete(deleteKey);
      expect(await adapter.exists(deleteKey)).toBe(false);
    });

    it("getStream throws for a missing key", async () => {
      const adapter = await createAdapter();
      await expect(adapter.getStream(`${key}-missing`)).rejects.toThrow();
    });

    it("exists returns false for a missing key", async () => {
      const adapter = await createAdapter();
      expect(await adapter.exists(`${key}-never-written`)).toBe(false);
    });

    it("healthCheck succeeds without listing", async () => {
      const adapter = await createAdapter();
      await expect(adapter.healthCheck()).resolves.toBeUndefined();
    });

    it("put overwrites an existing key", async () => {
      const adapter = await createAdapter();
      const overwriteKey = `${key}-overwrite`;
      await adapter.put(overwriteKey, "first");
      await adapter.put(overwriteKey, "second");
      const stream = await adapter.getStream(overwriteKey);
      expect((await readAll(stream)).toString("utf8")).toBe("second");
    });

    it("rejects path-traversal keys", async () => {
      const adapter = await createAdapter();
      await expect(adapter.put("../escape", "nope")).rejects.toThrow(
        /outside the storage root|Invalid storage key/,
      );
      await expect(adapter.put("a/b", "nope")).rejects.toThrow(
        /outside the storage root|Invalid storage key/,
      );
    });
  });
}
