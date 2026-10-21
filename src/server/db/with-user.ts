/**
 * Request-scoped DB context (B2-06): open a transaction, SET LOCAL
 * app.user_id / app.role (and ROLE app_user), then run fn(tx).
 */
import { sql } from "drizzle-orm";
import type { AppTx } from "./client.js";
import { getDb } from "./client.js";

export type UserRole = "admin" | "builder" | "viewer";

export type RequestContext = {
  userId: string;
  role: UserRole;
  requestId: string;
};

/**
 * Run `fn` inside a transaction with RLS GUCs set for the acting user.
 * All repository calls that need RLS should receive the same `tx`.
 *
 * `SET LOCAL ROLE app_user` only runs when the pool role can assume it
 * (local/CI). On Neon the owner often cannot `SET ROLE` to that login role;
 * GUCs still drive RLS helpers, and the owner connection matches the
 * migration README note (grant privileges to the pooled role instead).
 */
export async function withUser<T>(ctx: RequestContext, fn: (tx: AppTx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${ctx.userId}, true)`);
    await tx.execute(sql`SELECT set_config('app.role', ${ctx.role}, true)`);
    const roleCheck = await tx.execute<{ can_set: boolean }>(
      sql`SELECT pg_has_role(current_user, 'app_user', 'USAGE') AS can_set`,
    );
    const canSet = Boolean(
      (roleCheck as unknown as { rows?: Array<{ can_set?: boolean }> }).rows?.[0]?.can_set,
    );
    if (canSet) {
      await tx.execute(sql`SET LOCAL ROLE app_user`);
    }
    return fn(tx);
  });
}
