/**
 * Session primitives (B2-02): random token, store hash only, absolute + idle
 * expiry, revoke helpers, cookie flags.
 *
 * Constants (also in constants.ts for Edge-safe import):
 * - SESSION_ABSOLUTE_TTL_MS = 24 hours from createdAt
 * - SESSION_IDLE_TTL_MS = 24 hours from lastSeenAt
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_COOKIE_NAME, SESSION_IDLE_TTL_MS } from "./constants.js";
import { sessions } from "../db/schema.js";
import type { AppTx } from "../db/client.js";

export { SESSION_ABSOLUTE_TTL_MS, SESSION_COOKIE_NAME, SESSION_IDLE_TTL_MS } from "./constants.js";

const TOKEN_BYTES = 32;

export type SessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type Clock = () => Date;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** SHA-256 hex of the raw token — only this value is persisted. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * True when the session is usable at `now`:
 * not revoked, within absolute expiry, and within idle window.
 */
export function isSessionValid(session: SessionRow, now: Date = new Date()): boolean {
  if (session.revokedAt !== null) return false;
  if (now.getTime() >= session.expiresAt.getTime()) return false;
  const idleDeadline = session.lastSeenAt.getTime() + SESSION_IDLE_TTL_MS;
  if (now.getTime() >= idleDeadline) return false;
  return true;
}

export type SessionCookieFlags = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

/** Cookie flags for the session token cookie (HttpOnly, Secure in prod, SameSite=Lax). */
export function sessionCookieFlags(opts?: { secure?: boolean; now?: Date }): SessionCookieFlags {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000),
  };
}

export type CreateSessionInput = {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
  now?: Date;
};

export type CreateSessionResult = {
  sessionId: string;
  token: string;
  expiresAt: Date;
};

/** Insert a session row; returns the raw token (caller sets the cookie). */
export async function createSession(
  tx: AppTx,
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const now = input.now ?? new Date();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);

  const [row] = await tx
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash,
      expiresAt,
      lastSeenAt: now,
      createdAt: now,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    })
    .returning({ id: sessions.id });

  if (!row) {
    throw new Error("Failed to create session");
  }

  return { sessionId: row.id, token, expiresAt };
}

/** Revoke a single session by id. */
export async function revokeSession(
  tx: AppTx,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  await tx
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

/** Revoke every non-revoked session for a user. */
export async function revokeAllSessionsForUser(
  tx: AppTx,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await tx
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/**
 * Look up by raw token, enforce expiry/idle/revocation, optionally bump last_seen_at.
 * Returns null when the token is unknown or no longer valid.
 */
export async function resolveSession(
  tx: AppTx,
  token: string,
  opts?: { now?: Date; touch?: boolean },
): Promise<SessionRow | null> {
  const now = opts?.now ?? new Date();
  const tokenHash = hashSessionToken(token);
  const [row] = await tx.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
  if (!row) return null;

  const session: SessionRow = {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };

  if (!isSessionValid(session, now)) return null;

  if (opts?.touch !== false) {
    await tx.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, session.id));
    session.lastSeenAt = now;
  }

  return session;
}
