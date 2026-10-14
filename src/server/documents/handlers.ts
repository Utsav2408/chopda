/**
 * Thin handlers for document upload/download (B6-07).
 */
import { ZodError } from "zod";
import { z } from "zod";
import type { AuthContext } from "../authz/index.js";
import {
  Conflict,
  Forbidden,
  Internal,
  NotFound,
  RateLimited,
  Unauthenticated,
  Validation,
  type AppError,
} from "../kernel/errors.js";
import * as documents from "./service.js";
import type { DocumentsDownloadResult, DocumentsUploadResult } from "./types.js";

export type HandlerResult<T = unknown> = {
  status: number;
  body: T | { error: string; code: string };
};

const uploadMetaSchema = z.object({
  invoiceStepId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  fieldKey: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
});

function isAppError(err: unknown): err is AppError {
  return (
    err instanceof Unauthenticated ||
    err instanceof Forbidden ||
    err instanceof NotFound ||
    err instanceof Validation ||
    err instanceof Conflict ||
    err instanceof RateLimited ||
    err instanceof Internal
  );
}

export function mapErrorToHandlerResult(err: unknown): HandlerResult {
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? "Validation failed";
    return { status: 400, body: { error: message, code: "Validation" } };
  }
  if (isAppError(err)) {
    const status =
      err.code === "Unauthenticated"
        ? 401
        : err.code === "Forbidden" || err.code === "NotFound"
          ? 404
          : err.code === "Validation"
            ? 400
            : err.code === "Conflict"
              ? 409
              : err.code === "RateLimited"
                ? 429
                : 500;
    return { status, body: { error: err.message, code: err.code } };
  }
  return { status: 500, body: { error: "Internal error", code: "Internal" } };
}

export async function handleUpload(
  ctx: AuthContext,
  meta: unknown,
  bytes: Buffer | Uint8Array,
): Promise<HandlerResult<DocumentsUploadResult>> {
  try {
    const parsed = uploadMetaSchema.parse(meta);
    const result = await documents.upload(ctx, {
      invoiceStepId: parsed.invoiceStepId,
      filename: parsed.filename,
      bytes,
      fieldKey: parsed.fieldKey,
    });
    return { status: 201, body: result };
  } catch (err) {
    return mapErrorToHandlerResult(err) as HandlerResult<DocumentsUploadResult>;
  }
}

export async function handleDownload(
  ctx: AuthContext,
  documentId: string,
): Promise<{ ok: true; result: DocumentsDownloadResult } | { ok: false; handler: HandlerResult }> {
  try {
    const result = await documents.download(ctx, documentId);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, handler: mapErrorToHandlerResult(err) };
  }
}

export { uploadMetaSchema };
