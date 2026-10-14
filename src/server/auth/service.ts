/**
 * Auth services (B3-01, B3-02, B3-12).
 * login does not take ctx (it creates the session); other ops take RequestContext.
 */
import { audit } from "../audit/write.js";
import { requireRole } from "../authz/index.js";
import { getDb, type AppTx } from "../db/client.js";
import { withUser, type RequestContext } from "../db/with-user.js";
import { RateLimited, Unauthenticated, NotFound, Forbidden } from "../kernel/errors.js";
import { generateRequestId } from "../kernel/request-id.js";
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  type LoginRateLimitDecision,
} from "../security/rate-limit.js";
import {
  createSession,
  resolveSession as resolveSessionRow,
  revokeAllSessionsForUser,
  revokeSession,
  type CreateSessionResult,
  type SessionRow,
} from "../security/session.js";
import {
  dummyPasswordHash,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "../security/password.js";
import {
  findSessionByIdForUser,
  findUserById,
  findUserByUsername,
  listSessionsForUser,
  updatePasswordHash,
  type AuthUserRow,
  type SessionListRow,
} from "./repo.js";
import type { LoginBody } from "./schema.js";

const GENERIC_LOGIN_FAILURE = "Invalid username or password";

export type LoginInput = LoginBody & {
  ip: string;
  userAgent: string | null;
  requestId?: string;
};

export type PublicAuthUser = {
  id: string;
  username: string;
  role: AuthUserRow["role"];
  displayName: string;
  mustChangePassword: boolean;
};

export type LoginResult = {
  token: string;
  sessionId: string;
  expiresAt: Date;
  user: PublicAuthUser;
};

export type ResolvedSession = {
  session: SessionRow;
  user: PublicAuthUser;
  ctx: RequestContext;
};

/** Injectable deps for unit tests (B3-01 decision paths). */
export type LoginDeps = {
  checkRateLimit: (username: string, ip: string, now?: Date) => Promise<LoginRateLimitDecision>;
  recordAttempt: (username: string, ip: string, at?: Date) => Promise<void>;
  findUserByUsername: (username: string) => Promise<AuthUserRow | null>;
  createSession: (input: {
    userId: string;
    userAgent?: string | null;
    ip?: string | null;
    now?: Date;
  }) => Promise<CreateSessionResult>;
  writeAudit: (args: {
    ctx: RequestContext;
    action: string;
    entity: string;
    entityId?: string | null;
    after?: unknown;
  }) => Promise<void>;
  updatePasswordHash?: (userId: string, passwordHash: string) => Promise<void>;
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
  needsRehash: (passwordHash: string) => boolean;
  getDummyPasswordHash: () => Promise<string>;
  now?: () => Date;
};

function toPublicUser(user: AuthUserRow): PublicAuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    mustChangePassword: user.mustChangePassword,
  };
}

async function defaultLoginDeps(tx: AppTx): Promise<LoginDeps> {
  return {
    checkRateLimit: (username, ip, now) => checkLoginRateLimit(tx, username, ip, now),
    recordAttempt: (username, ip, at) => recordLoginAttempt(tx, username, ip, at),
    findUserByUsername: (username) => findUserByUsername(tx, username),
    createSession: (input) => createSession(tx, input),
    writeAudit: (args) =>
      audit({
        tx,
        ctx: args.ctx,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId,
        after: args.after,
      }),
    updatePasswordHash: (userId, passwordHash) => updatePasswordHash(tx, userId, passwordHash),
    verifyPassword,
    hashPassword,
    needsRehash,
    getDummyPasswordHash: dummyPasswordHash,
  };
}

/**
 * Sign in: rate-limit → verify (timing-safe for unknown users) → session → audit.
 * Always throws the same Unauthenticated message on credential failure.
 */
export async function login(input: LoginInput, deps?: Partial<LoginDeps>): Promise<LoginResult> {
  const requestId = input.requestId ?? generateRequestId();
  const run = async (resolved: LoginDeps): Promise<LoginResult> => {
    const now = resolved.now?.() ?? new Date();
    const rate = await resolved.checkRateLimit(input.username, input.ip, now);
    if (!rate.allowed) {
      throw new RateLimited("Too many requests");
    }

    const user = await resolved.findUserByUsername(input.username);
    const hash = user?.passwordHash ?? (await resolved.getDummyPasswordHash());
    const passwordOk = await resolved.verifyPassword(input.password, hash);

    if (!user || !user.isActive || !passwordOk) {
      await resolved.recordAttempt(input.username, input.ip, now);
      throw new Unauthenticated(GENERIC_LOGIN_FAILURE);
    }

    if (resolved.needsRehash(user.passwordHash) && resolved.updatePasswordHash) {
      const nextHash = await resolved.hashPassword(input.password);
      await resolved.updatePasswordHash(user.id, nextHash);
    }

    const session = await resolved.createSession({
      userId: user.id,
      userAgent: input.userAgent,
      ip: input.ip,
      now,
    });

    const ctx: RequestContext = {
      userId: user.id,
      role: user.role,
      requestId,
    };
    await resolved.writeAudit({
      ctx,
      action: "auth.login",
      entity: "session",
      entityId: session.sessionId,
      after: { userId: user.id, ip: input.ip },
    });

    return {
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      user: toPublicUser(user),
    };
  };

  if (deps && Object.keys(deps).length > 0) {
    const base: LoginDeps = {
      checkRateLimit: async () => ({ allowed: true }),
      recordAttempt: async () => undefined,
      findUserByUsername: async () => null,
      createSession: async () => {
        throw new Error("createSession not mocked");
      },
      writeAudit: async () => undefined,
      verifyPassword,
      hashPassword,
      needsRehash,
      getDummyPasswordHash: dummyPasswordHash,
      ...deps,
    };
    return run(base);
  }

  return getDb().transaction(async (tx) => {
    const resolved = await defaultLoginDeps(tx);
    return run(resolved);
  });
}

/** Revoke the session identified by the raw cookie token. */
export async function logout(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await getDb().transaction(async (tx) => {
    const session = await resolveSessionRow(tx, token, { touch: false });
    if (!session) return;
    await revokeSession(tx, session.id);
    const user = await findUserById(tx, session.userId);
    if (user) {
      await audit({
        tx,
        ctx: {
          userId: user.id,
          role: user.role,
          requestId: generateRequestId(),
        },
        action: "auth.logout",
        entity: "session",
        entityId: session.id,
      });
    }
  });
}

/** Revoke every session for the acting user. */
export async function logoutAll(ctx: RequestContext): Promise<void> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  await withUser(authed, async (tx) => {
    await revokeAllSessionsForUser(tx, authed.userId);
    await audit({
      tx,
      ctx: authed,
      action: "auth.logout_all",
      entity: "user",
      entityId: authed.userId,
    });
  });
}

/**
 * Resolve a raw session token to user+ctx; bumps last_seen_at.
 * Returns null when unknown/expired/revoked/inactive.
 */
export async function resolveSession(
  token: string | null | undefined,
  opts?: { requestId?: string; touch?: boolean },
): Promise<ResolvedSession | null> {
  if (!token) return null;
  return getDb().transaction(async (tx) => {
    const session = await resolveSessionRow(tx, token, { touch: opts?.touch !== false });
    if (!session) return null;
    const user = await findUserById(tx, session.userId);
    if (!user || !user.isActive) return null;
    const ctx: RequestContext = {
      userId: user.id,
      role: user.role,
      requestId: opts?.requestId ?? generateRequestId(),
    };
    return { session, user: toPublicUser(user), ctx };
  });
}

/** List the acting user's sessions (no token hashes). */
export async function listOwnSessions(ctx: RequestContext): Promise<SessionListRow[]> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  return withUser(authed, async (tx) => listSessionsForUser(tx, authed.userId));
}

/** Revoke one of the acting user's sessions by id. */
export async function revokeOwnSession(ctx: RequestContext, sessionId: string): Promise<void> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  await withUser(authed, async (tx) => {
    const row = await findSessionByIdForUser(tx, sessionId, authed.userId);
    if (!row) {
      throw new NotFound();
    }
    if (row.userId !== authed.userId) {
      throw new Forbidden();
    }
    await revokeSession(tx, sessionId);
    await audit({
      tx,
      ctx: authed,
      action: "sessions.revoke_own",
      entity: "session",
      entityId: sessionId,
    });
  });
}
