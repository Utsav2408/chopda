/**
 * Document upload / download (B6-05, B6-06).
 *
 * Never returns a public or presigned URL — callers stream through /api/files/[id].
 */
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { audit } from "../audit/write.js";
import { canSeeInvoice, requireRole, requireStepRole, type AuthContext } from "../authz/index.js";
import { withUser, type RequestContext, type UserRole } from "../db/with-user.js";
import * as flowRepo from "../flows/repo.js";
import { Conflict, NotFound, Validation } from "../kernel/errors.js";
import * as invoiceRepo from "../invoices/repo.js";
import { assertCanMutateInvoices, assertCanReadInvoices } from "../invoices/service.js";
import {
  DOCUMENTS_KEY_PREFIX,
  getStorageAdapter,
  toObjectKey,
  validateUpload,
  type StorageAdapter,
} from "../storage/index.js";
import type {
  DocumentsDownloadResult,
  DocumentsUploadInput,
  DocumentsUploadResult,
} from "./types.js";

const DOWNLOAD_CACHE_CONTROL = "private, max-age=31536000, immutable";

export type UploadDeps = {
  storage: StorageAdapter;
  storageProvider: string;
};

function defaultUploadDeps(): UploadDeps {
  return {
    storage: getStorageAdapter(),
    storageProvider: process.env.STORAGE_PROVIDER ?? "local",
  };
}

function asStepData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/**
 * Upload a file for an invoice step (B6-05).
 * validate → (optional sha256 reuse) → put → insert; orphan delete on insert failure.
 * Links document id into step data under `fieldKey` when provided.
 */
export async function upload(
  ctx: AuthContext,
  input: DocumentsUploadInput,
  deps: UploadDeps = defaultUploadDeps(),
): Promise<DocumentsUploadResult> {
  const authed = assertCanMutateInvoices(ctx);

  let validated;
  try {
    validated = validateUpload({ bytes: input.bytes, filename: input.filename });
  } catch (err) {
    throw new Validation(err instanceof Error ? err.message : "Invalid upload");
  }

  // Authz + step access checked inside the transaction before any put.
  const access = await withUser(authed, async (tx) => {
    const invoiceStep = await invoiceRepo.getInvoiceStepById(tx, input.invoiceStepId);
    if (!invoiceStep) throw new NotFound();

    const invoice = await invoiceRepo.getInvoiceById(tx, invoiceStep.invoiceId);
    if (!invoice || invoice.deletedAt) throw new NotFound();
    if (invoice.status === "cancelled" || invoice.status === "completed") {
      throw new Conflict(`Cannot upload to a ${invoice.status} invoice`);
    }
    if (invoiceStep.status === "completed") {
      throw new Conflict("Cannot upload to a completed step");
    }

    const flowStep = await flowRepo.getStepById(tx, invoiceStep.flowStepId);
    if (!flowStep) throw new NotFound();
    requireStepRole(authed, flowStep.allowedRole as UserRole);

    const existingByHash = await invoiceRepo.findDocumentBySha256(tx, validated.sha256);
    return { invoice, invoiceStep, flowStep, existingByHash };
  });

  const documentId = randomUUID();
  const reuseExisting = access.existingByHash !== undefined;
  const objectKey = reuseExisting ? access.existingByHash!.objectKey : toObjectKey(documentId);

  let putPerformed = false;
  if (!reuseExisting) {
    await deps.storage.put(objectKey, validated.bytes, { contentType: validated.mimeType });
    putPerformed = true;
  }

  try {
    const result = await withUser(authed, async (tx) => {
      // Re-check step still writable (race with complete/delete).
      const invoiceStep = await invoiceRepo.getInvoiceStepById(tx, input.invoiceStepId);
      if (!invoiceStep || invoiceStep.status === "completed") {
        throw new Conflict("Step is no longer writable");
      }
      const invoice = await invoiceRepo.getInvoiceById(tx, invoiceStep.invoiceId);
      if (!invoice || invoice.deletedAt) throw new NotFound();

      const doc = await invoiceRepo.insertDocument(tx, {
        // New puts key by document id; dedupe reuses existing object_key with a new row id.
        id: reuseExisting ? undefined : documentId,
        invoiceStepId: input.invoiceStepId,
        storageProvider: reuseExisting
          ? access.existingByHash!.storageProvider
          : deps.storageProvider,
        objectKey,
        originalFilename: input.filename,
        sha256: validated.sha256,
        mimeType: validated.mimeType,
        sizeBytes: BigInt(validated.sizeBytes),
        uploadedBy: authed.userId,
      });

      if (input.fieldKey) {
        const data = asStepData(invoiceStep.data);
        data[input.fieldKey] = doc.id;
        await invoiceRepo.updateInvoiceStepData(tx, invoiceStep.id, data);
      }

      await audit({
        tx,
        ctx: authed,
        action: "document.upload",
        entity: "document",
        entityId: doc.id,
        after: {
          invoiceStepId: doc.invoiceStepId,
          objectKey: doc.objectKey,
          sha256: doc.sha256,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes.toString(),
          duplicateOfExisting: reuseExisting,
          fieldKey: input.fieldKey ?? null,
        },
      });

      return {
        documentId: doc.id,
        objectKey: doc.objectKey,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        sha256: validated.sha256,
        duplicateOfExisting: reuseExisting,
      } satisfies DocumentsUploadResult;
    });
    return result;
  } catch (err) {
    if (putPerformed) {
      try {
        await deps.storage.delete(objectKey);
      } catch {
        // Best-effort orphan cleanup; surface the original error.
      }
    }
    throw err;
  }
}

/**
 * Download a document as a stream (B6-06). Audits the view. No public URL.
 */
export async function download(
  ctx: AuthContext,
  documentId: string,
  deps: Pick<UploadDeps, "storage"> = { storage: getStorageAdapter() },
): Promise<DocumentsDownloadResult> {
  const authed = assertCanReadInvoices(ctx);

  const meta = await withUser(authed, async (tx) => {
    const doc = await invoiceRepo.getDocumentById(tx, documentId);
    if (!doc || doc.deletedAt) throw new NotFound();

    const invoiceStep = await invoiceRepo.getInvoiceStepById(tx, doc.invoiceStepId);
    if (!invoiceStep) throw new NotFound();

    const invoice = await invoiceRepo.getInvoiceById(tx, invoiceStep.invoiceId);
    if (!invoice || !canSeeInvoice(authed, invoice)) {
      throw new NotFound();
    }

    await audit({
      tx,
      ctx: authed,
      action: "document.view",
      entity: "document",
      entityId: doc.id,
      after: { invoiceId: invoice.id, invoiceStepId: doc.invoiceStepId },
    });

    return doc;
  });

  const stream: Readable = await deps.storage.getStream(meta.objectKey);
  return {
    stream,
    mimeType: meta.mimeType,
    filename: meta.originalFilename,
    sizeBytes: Number(meta.sizeBytes),
    cacheControl: DOWNLOAD_CACHE_CONTROL,
  };
}

/** Auth gate helpers for role matrix (B6-08). */
export function assertCanUploadDocuments(ctx: AuthContext): RequestContext {
  return requireRole(ctx, "admin", "builder");
}

export function assertCanDownloadDocuments(ctx: AuthContext): RequestContext {
  return requireRole(ctx, "admin", "builder", "viewer");
}

export { DOWNLOAD_CACHE_CONTROL, DOCUMENTS_KEY_PREFIX };
