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
 */
export async function withUser<T>(ctx: RequestContext, fn: (tx: AppTx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${ctx.userId}, true)`);
    await tx.execute(sql`SELECT set_config('app.role', ${ctx.role}, true)`);
    // Ensure table privileges / RLS run as the limited role even if the pool
    // user is a member of app_user (or a superuser in local tests).
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    return fn(tx);
  });
}
