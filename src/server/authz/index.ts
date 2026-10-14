/**
 * Authorisation helpers (B2-08). Hiding a button is never enough — every
 * server path must call these (or equivalent) before mutating/reading.
 */
import { Forbidden, Unauthenticated } from "../kernel/errors.js";
import type { RequestContext, UserRole } from "../db/with-user.js";

export type { UserRole } from "../db/with-user.js";

export type AuthContext = RequestContext | null | undefined;

export type InvoiceVisibility = {
  ownerId: string;
  deletedAt: Date | null;
};

function assertAuthenticated(ctx: AuthContext): RequestContext {
  if (!ctx?.userId || !ctx.role) {
    throw new Unauthenticated();
  }
  return ctx;
}

/**
 * Require the acting user to hold one of the listed roles.
 * Signed-out → Unauthenticated; wrong role → Forbidden.
 */
export function requireRole(ctx: AuthContext, ...roles: UserRole[]): RequestContext {
  const authed = assertAuthenticated(ctx);
  if (!roles.includes(authed.role)) {
    throw new Forbidden();
  }
  return authed;
}

/**
 * Require the acting user to match a flow step's allowed role.
 * Admin may act on any step; otherwise role must equal `allowedRole`.
 */
export function requireStepRole(ctx: AuthContext, allowedRole: UserRole): RequestContext {
  const authed = assertAuthenticated(ctx);
  if (authed.role === "admin") {
    return authed;
  }
  if (authed.role !== allowedRole) {
    throw new Forbidden();
  }
  return authed;
}

/**
 * Whether the acting user may see this invoice (mirrors RLS: any authed role
 * for non-deleted; Admin also sees soft-deleted).
 */
export function canSeeInvoice(ctx: AuthContext, invoice: InvoiceVisibility): boolean {
  if (!ctx?.userId || !ctx.role) {
    return false;
  }
  if (invoice.deletedAt !== null) {
    return ctx.role === "admin";
  }
  return true;
}
