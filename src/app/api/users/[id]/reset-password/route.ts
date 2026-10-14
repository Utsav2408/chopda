import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { resetPassword } from "@/server/users";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const { ctx } = await requireAuthedRequest(request);
    const result = await resetPassword(ctx, id);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
