/**
 * GET /api/company/bank-accounts — list (Admin/Builder);
 * POST — add (Admin).
 */
import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { addBank, addBankAccountSchema, listBanks } from "@/server/company";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function GET(request: Request) {
  try {
    const { ctx } = await requireAuthedRequest(request);
    const accounts = await listBanks(ctx);
    return NextResponse.json({ accounts });
  } catch (err) {
    return jsonError(err);
  }
}

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
    const parsed = addBankAccountSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid bank account payload");
    const account = await addBank(ctx, parsed.data);
    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
