/**
 * B9-08e: live R2 StorageAdapter contract.
 * Skips unless STORAGE_PROVIDER=r2 and all R2_* env vars are set.
 * Intended for workflow_dispatch (.github/workflows/r2-contract.yml), not PR CI.
 */
import { describe } from "vitest";
import { createR2StorageAdapter } from "../../src/server/storage/r2.js";
import { defineStorageContractSuite } from "./contract.js";

const hasR2 =
  process.env.STORAGE_PROVIDER === "r2" &&
  Boolean(process.env.R2_ACCOUNT_ID) &&
  Boolean(process.env.R2_BUCKET) &&
  Boolean(process.env.R2_ACCESS_KEY_ID) &&
  Boolean(process.env.R2_SECRET_ACCESS_KEY);

describe.skipIf(!hasR2)("R2 live contract (B9-08e)", () => {
  defineStorageContractSuite("r2 live", () =>
    createR2StorageAdapter({
      trackOps: false,
    }),
  );
});
