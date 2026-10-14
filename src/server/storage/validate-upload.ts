import { createHash } from "node:crypto";

/**
 * Upload validation (B6-04): magic-byte type check, 10 MB size cap, sha256,
 * and duplicate detection by hash. Reject before any storage put.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export interface ValidatedUpload {
  mimeType: AllowedUploadMimeType;
  sizeBytes: number;
  sha256: string;
  bytes: Buffer;
}

export interface ValidateUploadInput {
  bytes: Buffer | Uint8Array;
  /** Original filename — used only for error messages, never for type trust. */
  filename?: string;
}

const PDF_MAGIC = Buffer.from("%PDF");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

function bufferStartsWith(buf: Buffer, magic: Buffer): boolean {
  return buf.length >= magic.length && buf.subarray(0, magic.length).equals(magic);
}

/**
 * Detect MIME from magic bytes. Extension is ignored.
 * DOCX/XLSX are ZIP containers; we peek for word/ or xl/ path markers.
 */
export function detectMimeFromMagicBytes(bytes: Buffer): AllowedUploadMimeType | null {
  if (bufferStartsWith(bytes, PDF_MAGIC)) {
    return "application/pdf";
  }
  if (bufferStartsWith(bytes, PNG_MAGIC)) {
    return "image/png";
  }
  if (bufferStartsWith(bytes, JPEG_MAGIC)) {
    return "image/jpeg";
  }
  if (bufferStartsWith(bytes, ZIP_MAGIC)) {
    // OOXML packages list part paths as ASCII inside the ZIP central directory.
    const asLatin1 = bytes.toString("latin1");
    if (asLatin1.includes("word/") || asLatin1.includes("word\\")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (asLatin1.includes("xl/") || asLatin1.includes("xl\\")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
  }
  return null;
}

export function sha256Hex(data: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Validate upload bytes: size cap, magic-byte type, sha256.
 * Throws Error with a clear message on refusal (callers map to Validation).
 */
export function validateUpload(input: ValidateUploadInput): ValidatedUpload {
  const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes);
  const label = input.filename ? ` (${input.filename})` : "";

  if (bytes.length === 0) {
    throw new Error(`Upload is empty${label}.`);
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Upload exceeds the ${MAX_UPLOAD_BYTES} byte (10 MB) size cap${label}: ${bytes.length} bytes.`,
    );
  }

  const mimeType = detectMimeFromMagicBytes(bytes);
  if (!mimeType) {
    throw new Error(
      `Upload type is not allowed${label}. Allowed: PDF, PNG, JPEG, DOCX, XLSX (detected by content, not extension).`,
    );
  }

  return {
    mimeType,
    sizeBytes: bytes.length,
    sha256: sha256Hex(bytes),
    bytes,
  };
}

/**
 * True when `sha256` already appears in `existingHashes` (e.g. live documents rows).
 * Used to warn on duplicates before put; sharing a key is a later upload-service concern.
 */
export function findDuplicateByHash(sha256: string, existingHashes: Iterable<string>): boolean {
  for (const existing of existingHashes) {
    if (existing === sha256) {
      return true;
    }
  }
  return false;
}
