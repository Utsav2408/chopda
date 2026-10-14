import { createReadStream } from "node:fs";
import { access, constants, mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { incrementStorageOps } from "./ops-counter.js";
import { DOCUMENTS_KEY_PREFIX, toObjectKey } from "./object-key.js";
import { createR2StorageAdapter } from "./r2.js";
import type { StorageAdapter, StoragePutOptions } from "./types.js";

/**
 * File storage adapter (B6-01 / B9-08d).
 *
 * Keys are document IDs. Adapters may prefix with `documents/` on the wire.
 * Contract (R2 free-tier rules apply even to local):
 * - put / getStream / delete / exists / healthCheck
 * - healthCheck must NOT list
 * - no multipart uploads
 *
 * This module does not `import "server-only"` so Node scripts
 * (scripts/storage-smoke.ts) can use it outside Next.js. App code should go
 * through `src/server/index.ts`.
 */

export { DOCUMENTS_KEY_PREFIX, toObjectKey };
export type { StorageAdapter, StoragePutOptions };

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

/**
 * Local adapter must never run where real uploads could be accepted.
 * B6-03: refuse NODE_ENV=production, or Vercel production with STORAGE_PROVIDER=local.
 */
function assertNotProductionLocal() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to start: local storage adapter must not run when NODE_ENV=production. " +
        "Switch STORAGE_PROVIDER to a durable provider (R2) before go-live (B9-08).",
    );
  }
  if (process.env.VERCEL_ENV === "production" && process.env.STORAGE_PROVIDER === "local") {
    throw new Error(
      "Refusing to start: STORAGE_PROVIDER=local in a production environment. " +
        "Switch to a durable provider before deploying anywhere that accepts uploads (B9-08).",
    );
  }
}

function safeJoin(root: string, objectKey: string): string {
  const rootResolved = resolve(root);
  const target = normalize(join(rootResolved, objectKey));
  const prefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep;
  if (target !== rootResolved && !target.startsWith(prefix)) {
    throw new Error(`Refusing to write outside the storage root: ${objectKey}`);
  }
  return target;
}

export type LocalStorageAdapterOptions = {
  /** When false, skip ops counter (parity with R2; default true). */
  trackOps?: boolean;
};

export function createLocalStorageAdapter(opts: LocalStorageAdapterOptions = {}): StorageAdapter {
  assertNotProductionLocal();
  const root = resolveStorageDir();
  const trackOps = opts.trackOps !== false;

  async function track(delta: { classA?: number; classB?: number }): Promise<void> {
    if (!trackOps) return;
    await incrementStorageOps(delta);
  }

  return {
    async put(key, data, _options) {
      const objectKey = toObjectKey(key);
      const target = safeJoin(root, objectKey);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
      await track({ classA: 1 });
    },
    async getStream(key) {
      const objectKey = toObjectKey(key);
      const target = safeJoin(root, objectKey);
      try {
        await access(target, constants.R_OK);
      } catch {
        throw new Error(`Object not found: ${key}`);
      }
      await track({ classB: 1 });
      return createReadStream(target);
    },
    async delete(key) {
      const objectKey = toObjectKey(key);
      const target = safeJoin(root, objectKey);
      await rm(target, { force: true });
    },
    async exists(key) {
      const objectKey = toObjectKey(key);
      const target = safeJoin(root, objectKey);
      try {
        const handle = await open(target, "r");
        await handle.close();
        await track({ classB: 1 });
        return true;
      } catch {
        await track({ classB: 1 });
        return false;
      }
    },
    async healthCheck() {
      // Stat the root only — never list directory contents (R2 Class A rule).
      const info = await stat(root);
      if (!info.isDirectory()) {
        throw new Error(`FILE_STORAGE_DIR is not a directory: ${root}`);
      }
      await track({ classB: 1 });
    },
  };
}

/**
 * Process-wide adapter factory. Local or R2 (B9-08d).
 */
export function getStorageAdapter(): StorageAdapter {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "local") {
    return createLocalStorageAdapter();
  }
  if (provider === "r2") {
    return createR2StorageAdapter();
  }
  throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
}

export {
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MIME_TYPES,
  sha256Hex,
  detectMimeFromMagicBytes,
  validateUpload,
  findDuplicateByHash,
  type AllowedUploadMimeType,
  type ValidatedUpload,
  type ValidateUploadInput,
} from "./validate-upload.js";

export {
  incrementStorageOps,
  getMonthStorageOps,
  storageBytesAlert,
  STORAGE_CLASS_A_MONTHLY_LIMIT,
  STORAGE_CLASS_B_MONTHLY_LIMIT,
  STORAGE_BYTES_ALERT_THRESHOLD,
  type MonthOpsTotals,
  type StorageOpsAlertLevel,
} from "./ops-counter.js";

export {
  createR2StorageAdapter,
  createR2S3Client,
  type R2Env,
  type R2AdapterOptions,
} from "./r2.js";
