import type { Readable } from "node:stream";

export interface StoragePutOptions {
  contentType?: string;
}

export interface StorageAdapter {
  /** Store bytes for a document ID. One put per file — never multipart. */
  put(key: string, data: Buffer | Uint8Array | string, options?: StoragePutOptions): Promise<void>;
  /** Stream object bytes. Callers must not buffer large files in memory. */
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Reachability probe. Must not list objects (Class A on R2). */
  healthCheck(): Promise<void>;
}
