import type { Readable } from "node:stream";
import { Readable as NodeReadable } from "node:stream";
import {
  toObjectKey,
  type StorageAdapter,
  type StoragePutOptions,
} from "../../src/server/storage/index.js";

/**
 * In-memory StorageAdapter for the B6-02 contract suite (no filesystem).
 */
export function createMemoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, Buffer>();

  function objectKey(key: string): string {
    return toObjectKey(key);
  }

  return {
    async put(key: string, data: Buffer | Uint8Array | string, _options?: StoragePutOptions) {
      const ok = objectKey(key);
      store.set(ok, Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data));
    },
    async getStream(key: string): Promise<Readable> {
      const ok = objectKey(key);
      const buf = store.get(ok);
      if (!buf) {
        throw new Error(`Object not found: ${key}`);
      }
      return NodeReadable.from(buf);
    },
    async delete(key: string) {
      store.delete(objectKey(key));
    },
    async exists(key: string) {
      return store.has(objectKey(key));
    },
    async healthCheck() {
      // No-op reachability probe — must not list (R2 Class A rule).
    },
  };
}
