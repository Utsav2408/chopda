/**
 * Thin server actions for user admin / self-service (B3-13).
 * Session is resolved from cookies server-side — never trust a client-supplied ctx.
 */
"use server";

import { cookies } from "next/headers";
import {
  changeOwnPassword,
  create,
  deactivate,
  get,
  getOwnProfile,
  list,
  reactivate,
  resetPassword,
  transferAdmin,
  updateOwnProfile,
  changeOwnPasswordSchema,
  createUserSchema,
  transferAdminSchema,
  updateOwnProfileSchema,
  type VisibleUser,
  type CreateUserResult,
  type ResetPasswordResult,
} from "../users/index.js";
import {
  listOwnSessions,
  logoutAll,
  revokeOwnSession,
  resolveSession,
  revokeOwnSessionSchema,
} from "../auth/index.js";
import { SESSION_COOKIE_NAME } from "../security/constants.js";
import { Unauthenticated, Validation } from "../kernel/errors.js";
async function ctxFromCookies(): Promise<{
  ctx: NonNullable<Awaited<ReturnType<typeof resolveSession>>>["ctx"];
  sessionId: string;
}> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const resolved = await resolveSession(token);
  if (!resolved) {
    throw new Unauthenticated();
  }
  return { ctx: resolved.ctx, sessionId: resolved.session.id };
}

export async function usersCreateAction(raw: unknown): Promise<CreateUserResult> {
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid create user payload");
  const { ctx } = await ctxFromCookies();
  return create(ctx, parsed.data);
}

export async function usersListAction(): Promise<VisibleUser[]> {
  const { ctx } = await ctxFromCookies();
  return list(ctx);
}

export async function usersGetAction(userId: string): Promise<VisibleUser> {
  const { ctx } = await ctxFromCookies();
  return get(ctx, userId);
}

export async function usersDeactivateAction(userId: string): Promise<VisibleUser> {
  const { ctx } = await ctxFromCookies();
  return deactivate(ctx, userId);
}

export async function usersReactivateAction(userId: string): Promise<VisibleUser> {
  const { ctx } = await ctxFromCookies();
  return reactivate(ctx, userId);
}

export async function usersResetPasswordAction(userId: string): Promise<ResetPasswordResult> {
  const { ctx } = await ctxFromCookies();
  return resetPassword(ctx, userId);
}

export async function usersChangeOwnPasswordAction(raw: unknown): Promise<void> {
  const parsed = changeOwnPasswordSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid password change payload");
  const { ctx, sessionId } = await ctxFromCookies();
  return changeOwnPassword(ctx, parsed.data, { currentSessionId: sessionId });
}

export async function usersTransferAdminAction(raw: unknown): Promise<{
  previousAdminId: string;
  newAdminId: string;
}> {
  const parsed = transferAdminSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid transfer payload");
  const { ctx } = await ctxFromCookies();
  return transferAdmin(ctx, parsed.data);
}

export async function usersUpdateOwnProfileAction(raw: unknown): Promise<VisibleUser> {
  const parsed = updateOwnProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid profile payload");
  const { ctx } = await ctxFromCookies();
  return updateOwnProfile(ctx, parsed.data);
}

export async function usersGetOwnProfileAction(): Promise<VisibleUser> {
  const { ctx } = await ctxFromCookies();
  return getOwnProfile(ctx);
}

export async function sessionsListOwnAction(): Promise<{
  sessions: Awaited<ReturnType<typeof listOwnSessions>>;
  currentSessionId: string;
}> {
  const { ctx, sessionId } = await ctxFromCookies();
  const sessions = await listOwnSessions(ctx);
  return { sessions, currentSessionId: sessionId };
}

export async function sessionsRevokeOwnAction(raw: unknown): Promise<void> {
  const parsed = revokeOwnSessionSchema.safeParse(
    typeof raw === "string" ? { sessionId: raw } : raw,
  );
  if (!parsed.success) throw new Validation("Invalid session id");
  const { ctx } = await ctxFromCookies();
  return revokeOwnSession(ctx, parsed.data.sessionId);
}

export async function authLogoutAllAction(): Promise<void> {
  const { ctx } = await ctxFromCookies();
  return logoutAll(ctx);
}
