import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorageAdapter, getStorageAdapter } from "../../src/server/storage/index.js";

/** NODE_ENV is typed read-only on process.env in @types/node. */
function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

describe("local storage adapter (B6-01 / B6-03)", () => {
  let dir: string;
  let prevFileStorageDir: string | undefined;
  let prevNodeEnv: string | undefined;
  let prevVercelEnv: string | undefined;
  let prevStorageProvider: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-storage-test-"));
    prevFileStorageDir = process.env.FILE_STORAGE_DIR;
    prevNodeEnv = process.env.NODE_ENV;
    prevVercelEnv = process.env.VERCEL_ENV;
    prevStorageProvider = process.env.STORAGE_PROVIDER;

    process.env.FILE_STORAGE_DIR = dir;
    setNodeEnv("test");
    delete process.env.VERCEL_ENV;
    process.env.STORAGE_PROVIDER = "local";
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    if (prevFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
    else process.env.FILE_STORAGE_DIR = prevFileStorageDir;
    setNodeEnv(prevNodeEnv);
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
    if (prevStorageProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = prevStorageProvider;
  });

  async function readStreamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  it("puts, streams, and deletes a file", async () => {
    const storage = createLocalStorageAdapter({ trackOps: false });
    await storage.put("doc-abc", "hello");
    expect(await storage.exists("doc-abc")).toBe(true);
    expect(await readStreamToString(await storage.getStream("doc-abc"))).toBe("hello");
    await storage.delete("doc-abc");
    expect(await storage.exists("doc-abc")).toBe(false);
  });

  it("healthCheck succeeds for a writable root", async () => {
    const storage = createLocalStorageAdapter({ trackOps: false });
    await expect(storage.healthCheck()).resolves.toBeUndefined();
  });

  it("rejects path traversal outside the storage root", async () => {
    const storage = createLocalStorageAdapter({ trackOps: false });
    await expect(storage.put("../escape", "nope")).rejects.toThrow(/outside the storage root/);
  });

  it("refuses to run when NODE_ENV=production", () => {
    setNodeEnv("production");
    expect(() => createLocalStorageAdapter({ trackOps: false })).toThrow(/NODE_ENV=production/);
  });

  it("refuses to run with STORAGE_PROVIDER=local when VERCEL_ENV=production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.STORAGE_PROVIDER = "local";
    expect(() => createLocalStorageAdapter({ trackOps: false })).toThrow(/Refusing to start/);
  });

  it("getStorageAdapter returns local when STORAGE_PROVIDER=local", async () => {
    const storage = getStorageAdapter();
    await storage.put("via-factory", "ok");
    expect(await storage.exists("via-factory")).toBe(true);
  });

  it("getStorageAdapter returns R2 adapter when STORAGE_PROVIDER=r2", () => {
    process.env.STORAGE_PROVIDER = "r2";
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    const storage = getStorageAdapter();
    expect(storage).toBeDefined();
    expect(typeof storage.put).toBe("function");
    expect(typeof storage.healthCheck).toBe("function");
  });
});
