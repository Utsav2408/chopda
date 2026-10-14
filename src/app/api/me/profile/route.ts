import { NextResponse } from "next/server";
import { requireAuthedRequest } from "@/server/auth/request-context";
import { updateOwnProfile, updateOwnProfileSchema } from "@/server/users";
import { assertInputSize, assertSameOrigin } from "@/server/security/csrf";
import { jsonError } from "@/server/http/map-error";
import { Validation } from "@/server/kernel/errors";

export async function PATCH(request: Request) {
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
    const parsed = updateOwnProfileSchema.safeParse(body);
    if (!parsed.success) throw new Validation("Invalid profile payload");
    const user = await updateOwnProfile(ctx, parsed.data);
    return NextResponse.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}
