/**
 * Auth persistence (B3-01..02, B3-12). Called only from auth/service.
 *
 * Login / resolve-by-token run on the pool connection (no SET LOCAL ROLE) so
 * username lookup and rate-limit counts work before a session exists. RLS is
 * bypassed by the table owner in local/CI; Neon should use the same pattern
 * for the auth bootstrap path or equivalent policies.
 */
import { and, desc, eq } from "drizzle-orm";
import { sessions, users } from "../db/schema.js";
import type { AppDb, AppTx } from "../db/client.js";
import type { UserRole } from "../db/with-user.js";

export type DbOrTx = AppDb | AppTx;

export type AuthUserRow = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  displayName: string;
  email: string | null;
  phone: string | null;
  photoObjectKey: string | null;
  mustChangePassword: boolean;
};

export type SessionListRow = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export async function findUserByUsername(
  db: DbOrTx,
  username: string,
): Promise<AuthUserRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      role: users.role,
      isActive: users.isActive,
      displayName: users.displayName,
      email: users.email,
      phone: users.phone,
      photoObjectKey: users.photoObjectKey,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row ?? null;
}

export async function findUserById(db: DbOrTx, userId: string): Promise<AuthUserRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      role: users.role,
      isActive: users.isActive,
      displayName: users.displayName,
      email: users.email,
      phone: users.phone,
      photoObjectKey: users.photoObjectKey,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function updatePasswordHash(
  db: DbOrTx,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function listSessionsForUser(db: DbOrTx, userId: string): Promise<SessionListRow[]> {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
}

export async function findSessionByIdForUser(
  db: DbOrTx,
  sessionId: string,
  userId: string,
): Promise<{ id: string; userId: string; revokedAt: Date | null } | null> {
  const [row] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  return row ?? null;
}
