/**
 * POST /api/company/bank-accounts/[id]/set-default — Admin.
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { setDefaultBank } from "@/server/company";
import { assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const account = await setDefaultBank(ctx, id);
    return NextResponse.json({ account });
  } catch (err) {
    return jsonError(err);
  }
}
