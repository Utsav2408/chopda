/**
 * GET /api/files/[id] — stream a document (B6-07).
 * Never serves the storage folder statically. No public/presign URL.
 */
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { download } from "@/server/documents";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

function contentDisposition(filename: string): string {
  const safe = filename.replace(/["\r\n]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const result = await download(ctx, id);

    const webStream = Readable.toWeb(result.stream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": String(result.sizeBytes),
        "Content-Disposition": contentDisposition(result.filename),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": result.cacheControl,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
