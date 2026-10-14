import { afterEach, beforeEach, describe } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorageAdapter } from "../../src/server/storage/index.js";
import { defineStorageContractSuite } from "./contract.js";
import { createMemoryStorageAdapter } from "./memory-fake.js";

/** NODE_ENV is typed read-only on process.env in @types/node. */
function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

defineStorageContractSuite("in-memory fake", () => createMemoryStorageAdapter());

describe("local adapter fixture", () => {
  let dir: string;
  let prevFileStorageDir: string | undefined;
  let prevNodeEnv: string | undefined;
  let prevVercelEnv: string | undefined;
  let prevStorageProvider: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-storage-contract-"));
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

  defineStorageContractSuite("local adapter", () => createLocalStorageAdapter({ trackOps: false }));
});
