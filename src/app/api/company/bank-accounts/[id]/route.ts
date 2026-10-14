/**
 * PATCH /api/company/bank-accounts/[id] — edit (Admin).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { editBank, editBankAccountSchema } from "@/server/company";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { ctx } = await requireAuthedRequest(request);
    const { id } = await params;
    const raw = await request.text();
    assertInputSize(new TextEncoder().encode(raw).byteLength);
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new Validation("Invalid JSON body");
    }
    const parsed = editBankAccountSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid bank account payload");
    const account = await editBank(ctx, id, parsed.data);
    return NextResponse.json({ account });
  } catch (err) {
    return jsonError(err);
  }
}
