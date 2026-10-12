import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";

/**
 * Minimal local-folder storage adapter (P0-04).
 *
 * This is intentionally a thin interface so a real provider (Google Drive or
 * Cloudflare R2, per P5-15) can replace it later without touching callers.
 * The local provider is for build/test only — see assertNotProductionLocal().
 *
 * NOTE: this module does not `import "server-only"` directly because it is also
 * imported by Node scripts (scripts/storage-smoke.ts, migrations) run outside
 * Next.js's server-component graph, where the "server-only" marker's default
 * export throws unconditionally. The real server-only boundary for app code is
 * src/server/index.ts — route everything the app (not scripts) needs through
 * there, and never import this file from a Client Component.
 */
export interface StorageAdapter {
  write(key: string, data: Buffer | string): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

function resolveStorageDir(): string {
  const dir = process.env.FILE_STORAGE_DIR;
  if (!dir) {
    throw new Error(
      "FILE_STORAGE_DIR is not set. Set it in .env to a folder outside the repo and outside /public.",
    );
  }
  if (!isAbsolute(dir)) {
    throw new Error("FILE_STORAGE_DIR must be an absolute path.");
  }
  return dir;
}

// Guard against the local adapter running anywhere real uploads could happen in
// production (plan rule 7 — "the local adapter must refuse to start in
// production"). STORAGE_PROVIDER must be switched before any such deployment.
function assertNotProductionLocal() {
  if (process.env.VERCEL_ENV === "production" && process.env.STORAGE_PROVIDER === "local") {
    throw new Error(
      "Refusing to start: STORAGE_PROVIDER=local in a production environment. " +
        "Switch to a durable provider before deploying anywhere that accepts uploads (P5-15).",
    );
  }
}

function safeJoin(root: string, key: string): string {
  // Prevent path traversal out of the storage root (e.g. key = "../../etc/passwd").
  const target = normalize(join(root, key));
  const rootResolved = resolve(root);
  if (!target.startsWith(rootResolved)) {
    throw new Error(`Refusing to write outside the storage root: ${key}`);
  }
  return target;
}

export function createLocalStorageAdapter(): StorageAdapter {
  assertNotProductionLocal();
  const root = resolveStorageDir();

  return {
    async write(key, data) {
      const target = safeJoin(root, key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    },
    async read(key) {
      const target = safeJoin(root, key);
      return readFile(target);
    },
    async delete(key) {
      const target = safeJoin(root, key);
      await rm(target, { force: true });
    },
    async exists(key) {
      const target = safeJoin(root, key);
      try {
        const handle = await open(target, "r");
        await handle.close();
        return true;
      } catch {
        return false;
      }
    },
  };
}
