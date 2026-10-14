/**
 * POST /api/files/upload — multipart upload (B6-07).
 * Fields: file (blob), invoiceStepId, filename (optional), fieldKey (optional).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { upload, uploadMetaSchema } from "@/server/documents";
import { assertSameOrigin } from "@/server/security/csrf";
import { MAX_UPLOAD_BYTES } from "@/server/storage";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new Validation("Expected multipart/form-data");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Validation("Missing file field");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Validation(`Upload exceeds the ${MAX_UPLOAD_BYTES} byte (10 MB) size cap`);
    }

    const invoiceStepId = String(form.get("invoiceStepId") ?? "");
    const filename = String(form.get("filename") ?? file.name ?? "upload.bin");
    const fieldKeyRaw = form.get("fieldKey");
    const fieldKey =
      typeof fieldKeyRaw === "string" && fieldKeyRaw.length > 0 ? fieldKeyRaw : undefined;

    const meta = uploadMetaSchema.safeParse({ invoiceStepId, filename, fieldKey });
    if (!meta.success) throw new Validation("Invalid upload metadata");

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await upload(ctx, {
      invoiceStepId: meta.data.invoiceStepId,
      filename: meta.data.filename,
      bytes,
      fieldKey: meta.data.fieldKey,
    });

    return NextResponse.json({ document: result }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
