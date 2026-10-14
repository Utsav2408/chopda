/**
 * Users persistence (B3-05..11). Called only from users/service.
 */
import { asc, eq, sql } from "drizzle-orm";
import { userPreferences, users } from "../db/schema.js";
import type { AppTx } from "../db/client.js";
import type { UserRole } from "../db/with-user.js";

export type UserRow = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type InsertUserInput = {
  username: string;
  passwordHash: string;
  role: "builder" | "viewer";
  displayName: string;
  email?: string | null;
  phone?: string | null;
  mustChangePassword: boolean;
};

/** List/get projections omit password_hash (B8-05 taint guard). */
export type UserSafeRow = Omit<UserRow, "passwordHash">;

const userSafeColumns = {
  id: users.id,
  username: users.username,
  role: users.role,
  isActive: users.isActive,
  displayName: users.displayName,
  email: users.email,
  phone: users.phone,
  photoObjectKey: users.photoObjectKey,
  mustChangePassword: users.mustChangePassword,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

const userAuthColumns = {
  ...userSafeColumns,
  passwordHash: users.passwordHash,
} as const;

export async function insertUser(tx: AppTx, input: InsertUserInput): Promise<UserRow> {
  const [row] = await tx
    .insert(users)
    .values({
      username: input.username,
      passwordHash: input.passwordHash,
      role: input.role,
      displayName: input.displayName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      mustChangePassword: input.mustChangePassword,
    })
    .returning(userAuthColumns);
  if (!row) {
    throw new Error("Failed to insert user");
  }
  return row;
}

export async function listUsers(tx: AppTx): Promise<UserSafeRow[]> {
  return tx.select(userSafeColumns).from(users).orderBy(asc(users.username));
}

export async function getUserById(tx: AppTx, userId: string): Promise<UserRow | null> {
  const [row] = await tx.select(userAuthColumns).from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

/** Safe get without password_hash for display paths. */
export async function getUserSafeById(tx: AppTx, userId: string): Promise<UserSafeRow | null> {
  const [row] = await tx.select(userSafeColumns).from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function setUserActive(
  tx: AppTx,
  userId: string,
  isActive: boolean,
): Promise<UserSafeRow | null> {
  const [row] = await tx
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(userSafeColumns);
  return row ?? null;
}

export async function setPasswordAndForceChange(
  tx: AppTx,
  userId: string,
  passwordHash: string,
): Promise<UserSafeRow | null> {
  const [row] = await tx
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning(userSafeColumns);
  return row ?? null;
}

export async function setOwnPassword(
  tx: AppTx,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await tx
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateProfile(
  tx: AppTx,
  userId: string,
  patch: {
    displayName?: string;
    email?: string | null;
    phone?: string | null;
    photoObjectKey?: string | null;
  },
): Promise<UserSafeRow | null> {
  const [row] = await tx
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(userSafeColumns);
  return row ?? null;
}

export async function upsertPreferences(
  tx: AppTx,
  userId: string,
  prefs: Record<string, unknown>,
): Promise<void> {
  await tx
    .insert(userPreferences)
    .values({ userId, prefs, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { prefs, updatedAt: new Date() },
    });
}

export async function getPreferences(tx: AppTx, userId: string): Promise<Record<string, unknown>> {
  const [row] = await tx
    .select({ prefs: userPreferences.prefs })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const prefs = row?.prefs;
  if (prefs && typeof prefs === "object" && !Array.isArray(prefs)) {
    return prefs as Record<string, unknown>;
  }
  return {};
}

/**
 * Transfer Admin in one transaction: demote current admin to builder, then
 * promote target to admin (preserves one_admin unique index).
 */
export async function transferAdminRoles(
  tx: AppTx,
  currentAdminId: string,
  newAdminId: string,
): Promise<{ previousAdmin: UserSafeRow; newAdmin: UserSafeRow }> {
  const [previousAdmin] = await tx
    .update(users)
    .set({ role: "builder", updatedAt: new Date() })
    .where(eq(users.id, currentAdminId))
    .returning(userSafeColumns);
  if (!previousAdmin) {
    throw new Error("Failed to demote current admin");
  }

  const [newAdmin] = await tx
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, newAdminId))
    .returning(userSafeColumns);
  if (!newAdmin) {
    throw new Error("Failed to promote new admin");
  }

  return { previousAdmin, newAdmin };
}

export async function countAdmins(tx: AppTx): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return row?.count ?? 0;
}
