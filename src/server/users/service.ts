/**
 * User administration services (B3-05..11).
 * Every function takes ctx and re-checks roles via requireRole.
 */
import { audit } from "../audit/write.js";
import { listSessionsForUser } from "../auth/repo.js";
import { requireRole } from "../authz/index.js";
import { withUser, type RequestContext } from "../db/with-user.js";
import { Conflict, Forbidden, NotFound, Unauthenticated, Validation } from "../kernel/errors.js";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "../security/password.js";
import { revokeAllSessionsForUser, revokeSession } from "../security/session.js";
import type {
  ChangeOwnPasswordInput,
  CreateUserInput,
  TransferAdminInput,
  UpdateOwnProfileInput,
} from "./schema.js";
import {
  countAdmins,
  getPreferences,
  getUserById,
  getUserSafeById,
  insertUser,
  listUsers,
  setOwnPassword,
  setPasswordAndForceChange,
  setUserActive,
  transferAdminRoles,
  updateProfile,
  upsertPreferences,
  type UserRow,
  type UserSafeRow,
} from "./repo.js";

/** User view with column-level contact visibility applied. */
export type VisibleUser = {
  id: string;
  username: string;
  role: UserRow["role"];
  isActive: boolean;
  displayName: string;
  email: string | null;
  phone: string | null;
  photoObjectKey: string | null;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  prefs?: Record<string, unknown>;
};

export type CreateUserResult = {
  user: VisibleUser;
  temporaryPassword: string;
};

export type ResetPasswordResult = {
  temporaryPassword: string;
};

/** Optional deps for unit tests (role checks + create path). */
export type CreateUserDeps = {
  insertUser: (input: {
    username: string;
    passwordHash: string;
    role: "builder" | "viewer";
    displayName: string;
    email?: string | null;
    phone?: string | null;
    mustChangePassword: boolean;
  }) => Promise<UserRow>;
  hashPassword: (password: string) => Promise<string>;
  generateTemporaryPassword: () => string;
  writeAudit: (args: {
    action: string;
    entity: string;
    entityId?: string | null;
    after?: unknown;
  }) => Promise<void>;
};

function projectUser(
  row: Omit<UserRow, "passwordHash"> | UserRow,
  viewer: RequestContext,
): VisibleUser {
  const canSeeContact = viewer.role === "admin" || viewer.userId === row.id;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    isActive: row.isActive,
    displayName: row.displayName,
    email: canSeeContact ? row.email : null,
    phone: canSeeContact ? row.phone : null,
    photoObjectKey: row.photoObjectKey,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertAuthenticated(ctx: RequestContext | null | undefined): RequestContext {
  if (!ctx?.userId || !ctx.role) {
    throw new Unauthenticated();
  }
  return ctx;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; cause?: { code?: string } };
  if (e.code === "23505" || e.cause?.code === "23505") return true;
  const message = e.message ?? "";
  return (
    message.includes("unique") ||
    message.includes("duplicate") ||
    message.includes("users_username")
  );
}

/** Admin-only: create Builder or Viewer with a one-time temporary password. */
export async function create(
  ctx: RequestContext | null | undefined,
  input: CreateUserInput,
  deps?: Partial<CreateUserDeps>,
): Promise<CreateUserResult> {
  const authed = requireRole(ctx, "admin");

  if (input.role !== "builder" && input.role !== "viewer") {
    throw new Validation("Only builder or viewer roles can be created");
  }

  const run = async (resolved: CreateUserDeps): Promise<CreateUserResult> => {
    const temporaryPassword = resolved.generateTemporaryPassword();
    const passwordHash = await resolved.hashPassword(temporaryPassword);
    let row: UserRow;
    try {
      row = await resolved.insertUser({
        username: input.username,
        passwordHash,
        role: input.role,
        displayName: input.displayName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        mustChangePassword: true,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Conflict("Username already taken");
      }
      throw err;
    }
    await resolved.writeAudit({
      action: "users.create",
      entity: "user",
      entityId: row.id,
      after: { username: row.username, role: row.role },
    });
    return { user: projectUser(row, authed), temporaryPassword };
  };

  if (deps && Object.keys(deps).length > 0) {
    return run({
      insertUser: async () => {
        throw new Error("insertUser not mocked");
      },
      hashPassword,
      generateTemporaryPassword,
      writeAudit: async () => undefined,
      ...deps,
    });
  }

  return withUser(authed, async (tx) =>
    run({
      insertUser: (values) => insertUser(tx, values),
      hashPassword,
      generateTemporaryPassword,
      writeAudit: (args) =>
        audit({
          tx,
          ctx: authed,
          action: args.action,
          entity: args.entity,
          entityId: args.entityId,
          after: args.after,
        }),
    }),
  );
}

/** List users; phone/email only for Admin or self. */
export async function list(ctx: RequestContext | null | undefined): Promise<VisibleUser[]> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  return withUser(authed, async (tx) => {
    const rows = await listUsers(tx);
    return rows.map((row) => projectUser(row, authed));
  });
}

/** Get one user; phone/email only for Admin or self. */
export async function get(
  ctx: RequestContext | null | undefined,
  userId: string,
): Promise<VisibleUser> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  return withUser(authed, async (tx) => {
    const row = await getUserSafeById(tx, userId);
    if (!row) throw new NotFound();
    return projectUser(row, authed);
  });
}

/** Own profile including prefs (U5-01). */
export async function getOwnProfile(ctx: RequestContext | null | undefined): Promise<VisibleUser> {
  const authed = requireRole(assertAuthenticated(ctx), "admin", "builder", "viewer");
  return withUser(authed, async (tx) => {
    const row = await getUserSafeById(tx, authed.userId);
    if (!row) throw new NotFound();
    const prefs = await getPreferences(tx, authed.userId);
    return { ...projectUser(row, authed), prefs };
  });
}

/** Deactivate a non-Admin user and revoke their sessions. */
export async function deactivate(
  ctx: RequestContext | null | undefined,
  userId: string,
): Promise<VisibleUser> {
  const authed = requireRole(ctx, "admin");
  return withUser(authed, async (tx) => {
    const target = await getUserById(tx, userId);
    if (!target) throw new NotFound();
    if (target.role === "admin") {
      throw new Forbidden("Admin cannot be deactivated");
    }
    const updated = await setUserActive(tx, userId, false);
    if (!updated) throw new NotFound();
    await revokeAllSessionsForUser(tx, userId);
    await audit({
      tx,
      ctx: authed,
      action: "users.deactivate",
      entity: "user",
      entityId: userId,
      before: { isActive: true },
      after: { isActive: false },
    });
    return projectUser(updated, authed);
  });
}

/** Reactivate a user. */
export async function reactivate(
  ctx: RequestContext | null | undefined,
  userId: string,
): Promise<VisibleUser> {
  const authed = requireRole(ctx, "admin");
  return withUser(authed, async (tx) => {
    const target = await getUserById(tx, userId);
    if (!target) throw new NotFound();
    const updated = await setUserActive(tx, userId, true);
    if (!updated) throw new NotFound();
    await audit({
      tx,
      ctx: authed,
      action: "users.reactivate",
      entity: "user",
      entityId: userId,
      before: { isActive: false },
      after: { isActive: true },
    });
    return projectUser(updated, authed);
  });
}

/** Admin reset: temp password, force change, revoke sessions. */
export async function resetPassword(
  ctx: RequestContext | null | undefined,
  userId: string,
): Promise<ResetPasswordResult> {
  const authed = requireRole(ctx, "admin");
  return withUser(authed, async (tx) => {
    const target = await getUserById(tx, userId);
    if (!target) throw new NotFound();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const updated = await setPasswordAndForceChange(tx, userId, passwordHash);
    if (!updated) throw new NotFound();
    await revokeAllSessionsForUser(tx, userId);
    await audit({
      tx,
      ctx: authed,
      action: "users.reset_password",
      entity: "user",
      entityId: userId,
    });
    return { temporaryPassword };
  });
}

/**
 * Change own password; revoke other sessions (keep currentSessionId when set).
 */
export async function changeOwnPassword(
  ctx: RequestContext | null | undefined,
  input: ChangeOwnPasswordInput,
  opts?: { currentSessionId?: string },
): Promise<void> {
  const authed = requireRole(assertAuthenticated(ctx), "admin", "builder", "viewer");
  await withUser(authed, async (tx) => {
    const self = await getUserById(tx, authed.userId);
    if (!self) throw new NotFound();
    const ok = await verifyPassword(input.oldPassword, self.passwordHash);
    if (!ok) {
      throw new Validation("Current password is incorrect");
    }
    const passwordHash = await hashPassword(input.newPassword);
    await setOwnPassword(tx, authed.userId, passwordHash);

    if (opts?.currentSessionId) {
      const sessions = await listSessionsForUser(tx, authed.userId);
      for (const s of sessions) {
        if (s.id !== opts.currentSessionId && s.revokedAt === null) {
          await revokeSession(tx, s.id);
        }
      }
    } else {
      await revokeAllSessionsForUser(tx, authed.userId);
    }

    await audit({
      tx,
      ctx: authed,
      action: "users.change_own_password",
      entity: "user",
      entityId: authed.userId,
    });
  });
}

/**
 * Transfer Admin in one transaction; old Admin becomes Builder.
 * Preserves the one_admin unique index.
 */
export async function transferAdmin(
  ctx: RequestContext | null | undefined,
  input: TransferAdminInput,
): Promise<{ previousAdminId: string; newAdminId: string }> {
  const authed = requireRole(ctx, "admin");
  if (input.newAdminUserId === authed.userId) {
    throw new Validation("Cannot transfer Admin to yourself");
  }

  return withUser(authed, async (tx) => {
    const beforeCount = await countAdmins(tx);
    if (beforeCount !== 1) {
      throw new Conflict("Expected exactly one Admin");
    }

    const target = await getUserById(tx, input.newAdminUserId);
    if (!target) throw new NotFound();
    if (!target.isActive) {
      throw new Validation("New Admin must be an active user");
    }
    if (target.role === "admin") {
      throw new Conflict("Target is already Admin");
    }

    const { previousAdmin, newAdmin } = await transferAdminRoles(
      tx,
      authed.userId,
      input.newAdminUserId,
    );

    const afterCount = await countAdmins(tx);
    if (afterCount !== 1) {
      throw new Conflict("Admin transfer left an invalid admin count");
    }

    await audit({
      tx,
      ctx: authed,
      action: "users.transfer_admin",
      entity: "user",
      entityId: newAdmin.id,
      before: { adminId: previousAdmin.id, role: "admin" },
      after: { adminId: newAdmin.id, previousRole: previousAdmin.role },
    });

    return { previousAdminId: previousAdmin.id, newAdminId: newAdmin.id };
  });
}

/** Update own profile fields (not role). Optionally upsert prefs. */
export async function updateOwnProfile(
  ctx: RequestContext | null | undefined,
  input: UpdateOwnProfileInput,
): Promise<VisibleUser> {
  const authed = requireRole(assertAuthenticated(ctx), "admin", "builder", "viewer");

  if (
    input.displayName === undefined &&
    input.email === undefined &&
    input.phone === undefined &&
    input.photoObjectKey === undefined &&
    input.prefs === undefined
  ) {
    throw new Validation("No profile fields to update");
  }

  return withUser(authed, async (tx) => {
    const patch: {
      displayName?: string;
      email?: string | null;
      phone?: string | null;
      photoObjectKey?: string | null;
    } = {};
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.photoObjectKey !== undefined) patch.photoObjectKey = input.photoObjectKey;

    let row: UserSafeRow | UserRow | null = null;
    if (Object.keys(patch).length > 0) {
      row = await updateProfile(tx, authed.userId, patch);
    } else {
      row = await getUserById(tx, authed.userId);
    }
    if (!row) throw new NotFound();

    if (input.prefs !== undefined) {
      await upsertPreferences(tx, authed.userId, input.prefs);
    }

    const prefs = await getPreferences(tx, authed.userId);
    await audit({
      tx,
      ctx: authed,
      action: "users.update_own_profile",
      entity: "user",
      entityId: authed.userId,
      after: { ...patch, prefsUpdated: input.prefs !== undefined },
    });

    return { ...projectUser(row, authed), prefs };
  });
}
