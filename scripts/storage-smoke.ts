#!/usr/bin/env tsx
// Scripted smoke test for the local storage adapter (B6-01 / P0-04 evidence):
// put, getStream, delete a file in FILE_STORAGE_DIR, and confirm it is gitignored.
import "dotenv/config";
import { execSync } from "node:child_process";
import { createLocalStorageAdapter } from "../src/server/storage/index.js";

async function readStreamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const key = `smoke-${Date.now()}`;
  const payload = "chopda storage smoke test — synthetic data only";

  const storage = createLocalStorageAdapter();

  await storage.healthCheck();
  console.log("[storage-smoke] healthCheck ok");

  await storage.put(key, payload, { contentType: "text/plain" });
  console.log(`[storage-smoke] put ${key}`);

  const existsAfterWrite = await storage.exists(key);
  if (!existsAfterWrite) throw new Error("exists() returned false right after put()");

  const readBack = await readStreamToString(await storage.getStream(key));
  if (readBack !== payload) {
    throw new Error(
      `getStream() mismatch: expected ${JSON.stringify(payload)}, got ${JSON.stringify(readBack)}`,
    );
  }
  console.log(`[storage-smoke] getStream back ${key} correctly`);

  await storage.delete(key);
  const existsAfterDelete = await storage.exists(key);
  if (existsAfterDelete) throw new Error("exists() returned true after delete()");
  console.log(`[storage-smoke] deleted ${key}`);

  // Confirm the storage dir itself is outside the repo (and therefore can't be
  // accidentally committed) when it happens to live inside this working tree.
  const dir = process.env.FILE_STORAGE_DIR;
  if (dir && dir.startsWith(process.cwd())) {
    try {
      const out = execSync(`git check-ignore -v ${JSON.stringify(dir)}`, {
        cwd: process.cwd(),
      }).toString();
      console.log(`[storage-smoke] FILE_STORAGE_DIR is gitignored:\n${out.trim()}`);
    } catch {
      console.warn(
        "[storage-smoke] WARNING: FILE_STORAGE_DIR is inside the repo and is NOT " +
          "covered by .gitignore. Move it outside the repo or add a rule for it.",
      );
      process.exitCode = 1;
    }
  } else {
    console.log("[storage-smoke] FILE_STORAGE_DIR is outside the repo — nothing to check-ignore.");
  }

  console.log("[storage-smoke] OK");
}

main().catch((err) => {
  console.error("[storage-smoke] FAILED:", err);
  process.exit(1);
});
