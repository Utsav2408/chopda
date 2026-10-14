import { NextResponse } from "next/server";
import { revokeOwnSession } from "@/server/auth";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    await revokeOwnSession(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
