/**
 * Document upload / download contracts (B6-05 … B6-08).
 */
import type { AllowedUploadMimeType } from "../storage/validate-upload.js";
import type { Readable } from "node:stream";

/** B6-05 — documents.upload */
export interface DocumentsUploadInput {
  invoiceStepId: string;
  filename: string;
  bytes: Buffer | Uint8Array;
  /**
   * When set, the new document id is written into the invoice step's `data`
   * under this field key (file-type fields).
   */
  fieldKey?: string;
}

export interface DocumentsUploadResult {
  documentId: string;
  objectKey: string;
  mimeType: AllowedUploadMimeType;
  sizeBytes: number;
  sha256: string;
  /** True when another live document already has this sha256 (object_key reused). */
  duplicateOfExisting: boolean;
}

/** B6-06 — documents.download (stream only — never a public/presign URL). */
export interface DocumentsDownloadInput {
  documentId: string;
}

export interface DocumentsDownloadResult {
  stream: Readable;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  /** Cache-Control for immutable private downloads. */
  cacheControl: string;
}

/**
 * B6-07 route surface.
 * GET  /api/files/[id]
 * POST /api/files/upload
 */
export const DOCUMENTS_FILE_ROUTE_PREFIX = "/api/files" as const;

/** B6-08 — role-matrix action names for document operations. */
export type DocumentsRoleAction = "upload" | "download";
