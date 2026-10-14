import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { transferAdmin, transferAdminSchema } from "@/server/users";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const parsed = transferAdminSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid transfer payload");
    const result = await transferAdmin(ctx, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
