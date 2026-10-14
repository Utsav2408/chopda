/**
 * Declarative role matrix (B2-12 / B3-14 / B4-11). Every service/handler op that
 * is role-gated appears here. The test file runs every row for signed-out /
 * viewer / builder / admin and fails on unexpected allows or unexpected denials.
 *
 * Later phases (B5+) append rows in their PRs.
 */
import { Forbidden, Unauthenticated } from "../../src/server/kernel/errors.js";
import { requireRole } from "../../src/server/authz/index.js";
import type { RequestContext, UserRole } from "../../src/server/db/with-user.js";
import { create as usersCreate } from "../../src/server/users/service.js";
import type { UserRow } from "../../src/server/users/repo.js";
import { assertCanMutateFlows, assertCanReadFlows } from "../../src/server/flows/service.js";

export type Actor = "signed-out" | "viewer" | "builder" | "admin";

export type Expectation = "allow" | "deny";

export type MatrixRow = {
  /** Stable id for CI output, e.g. "requireRole-admin". */
  id: string;
  /** Human-readable operation name. */
  operation: string;
  expectations: Record<Actor, Expectation>;
  /**
   * Invoke the operation as the given actor.
   * Should throw Unauthenticated/Forbidden (or return) consistently with authz.
   */
  run: (actor: Actor) => void | Promise<void>;
};

export const ACTORS: Actor[] = ["signed-out", "viewer", "builder", "admin"];

export function ctxFor(actor: Actor): RequestContext | null {
  if (actor === "signed-out") return null;
  return {
    userId: `00000000-0000-4000-8000-${actor.padStart(12, "0").slice(-12)}`,
    role: actor as UserRole,
    requestId: `test-${actor}`,
  };
}

/** True when the thrown error is an authz denial (signed-out or forbidden). */
export function isDenial(err: unknown): boolean {
  return err instanceof Unauthenticated || err instanceof Forbidden;
}

const mockCreatedUser: UserRow = {
  id: "99999999-9999-4999-8999-999999999999",
  username: "matrix-user",
  passwordHash: "x",
  role: "viewer",
  isActive: true,
  displayName: "Matrix User",
  email: null,
  phone: null,
  photoObjectKey: null,
  mustChangePassword: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const createMocks = {
  insertUser: async () => mockCreatedUser,
  hashPassword: async () => "hashed",
  generateTemporaryPassword: () => "temp-password-xx",
  writeAudit: async () => undefined,
};

/**
 * Role matrix rows for B2 + B3. Authz gates mirror each service's requireRole;
 * users.create also exercises the service with mocked persistence so allow
 * paths need no database.
 */
export const ROLE_MATRIX_EXPECTED_IDS = [
  "requireRole-admin",
  "users.create",
  "users.list",
  "users.get",
  "users.deactivate",
  "users.reactivate",
  "users.resetPassword",
  "users.changeOwnPassword",
  "users.transferAdmin",
  "users.updateOwnProfile",
  "sessions.listOwn",
  "sessions.revokeOwn",
  "auth.logoutAll",
  "auth.login",
  "flows-mutate",
  "flows-read",
] as const;

export const ROLE_MATRIX: MatrixRow[] = [
  {
    id: "requireRole-admin",
    operation: "requireRole(ctx, 'admin')",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin");
    },
  },

  // --- B3 identity / administration ---
  {
    id: "users.create",
    operation: "users.create (Admin; Builder/Viewer only)",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    async run(actor) {
      await usersCreate(
        ctxFor(actor),
        { username: "matrix-user", displayName: "Matrix User", role: "viewer" },
        createMocks,
      );
    },
  },
  {
    id: "users.list",
    operation: "users.list",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "users.get",
    operation: "users.get",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "users.deactivate",
    operation: "users.deactivate",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin");
    },
  },
  {
    id: "users.reactivate",
    operation: "users.reactivate",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin");
    },
  },
  {
    id: "users.resetPassword",
    operation: "users.resetPassword",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin");
    },
  },
  {
    id: "users.changeOwnPassword",
    operation: "users.changeOwnPassword",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "users.transferAdmin",
    operation: "users.transferAdmin",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin");
    },
  },
  {
    id: "users.updateOwnProfile",
    operation: "users.updateOwnProfile",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "sessions.listOwn",
    operation: "sessions.listOwn",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "sessions.revokeOwn",
    operation: "sessions.revokeOwn",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "auth.logoutAll",
    operation: "auth.logoutAll",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },
  {
    id: "auth.login",
    operation: "auth.login (public; no requireRole)",
    expectations: {
      "signed-out": "allow",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run() {
      // Login is intentionally unauthenticated; matrix documents the allow.
    },
  },

  // --- B4 flows ---
  {
    id: "flows-mutate",
    operation: "flows.create/edit/publish/archive",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanMutateFlows(ctxFor(actor));
    },
  },
  {
    id: "flows-read",
    operation: "flows.list/get/diff",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanReadFlows(ctxFor(actor));
    },
  },
];
