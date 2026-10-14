import { isAbsolute } from "node:path";

export const DOCUMENTS_KEY_PREFIX = "documents/";

/**
 * Normalize a caller key (document ID) into the object key used under the root.
 * Rejects path traversal and absolute paths.
 */
export function toObjectKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Storage key must be a non-empty string (document ID).");
  }
  if (key.includes("\0")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  const id = key.startsWith(DOCUMENTS_KEY_PREFIX) ? key.slice(DOCUMENTS_KEY_PREFIX.length) : key;
  if (
    id.length === 0 ||
    id.includes("..") ||
    id.includes("/") ||
    id.includes("\\") ||
    isAbsolute(id)
  ) {
    throw new Error(`Refusing to write outside the storage root: ${key}`);
  }
  return `${DOCUMENTS_KEY_PREFIX}${id}`;
}
