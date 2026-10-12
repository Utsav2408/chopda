import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorageAdapter } from "../../src/server/storage/index.js";

describe("local storage adapter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-storage-test-"));
    process.env.FILE_STORAGE_DIR = dir;
    delete process.env.VERCEL_ENV;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.FILE_STORAGE_DIR;
  });

  it("writes, reads and deletes a file", async () => {
    const storage = createLocalStorageAdapter();
    await storage.write("a/b.txt", "hello");
    expect(await storage.exists("a/b.txt")).toBe(true);
    expect((await storage.read("a/b.txt")).toString()).toBe("hello");
    await storage.delete("a/b.txt");
    expect(await storage.exists("a/b.txt")).toBe(false);
  });

  it("rejects path traversal outside the storage root", async () => {
    const storage = createLocalStorageAdapter();
    await expect(storage.write("../escape.txt", "nope")).rejects.toThrow(
      /outside the storage root/,
    );
  });

  it("refuses to run with STORAGE_PROVIDER=local in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STORAGE_PROVIDER = "local";
    expect(() => createLocalStorageAdapter()).toThrow(/Refusing to start/);
    delete process.env.STORAGE_PROVIDER;
  });
});
