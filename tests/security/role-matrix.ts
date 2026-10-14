/**
 * Declarative role matrix (B2–B8). Every service/handler op that is role-gated
 * appears here. B9 may append hardening rows later.
 */
import { Forbidden, Unauthenticated } from "../../src/server/kernel/errors.js";
import { requireRole } from "../../src/server/authz/index.js";
import type { RequestContext, UserRole } from "../../src/server/db/with-user.js";
import { create as usersCreate } from "../../src/server/users/service.js";
import type { UserRow } from "../../src/server/users/repo.js";
import { assertCanMutateFlows, assertCanReadFlows } from "../../src/server/flows/service.js";
import {
  assertCanMutateInvoices,
  assertCanReadInvoices,
} from "../../src/server/invoices/service.js";
import {
  assertCanUploadDocuments,
  assertCanDownloadDocuments,
} from "../../src/server/documents/service.js";
import { requireCronSecret } from "../../src/server/security/cron.js";

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
  "invoices.create",
  "invoices.update",
  "invoices.get",
  "steps.complete",
  "documents.upload",
  "documents.download",
  "invoices.list",
  "dashboard.read",
  "history.forInvoice",
  "reminders.compute",
  "invoices.softDelete",
  "invoices.undo",
  "company.get",
  "company.update",
  "company.listBanks",
  "company.mutateBanks",
  "company.summary",
  "health.check",
  "cron.purge",
  "cron.reminders",
  "jobs.purge",
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

  // --- B5 invoices + steps ---
  {
    id: "invoices.create",
    operation: "invoices.create",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanMutateInvoices(ctxFor(actor));
    },
  },
  {
    id: "invoices.update",
    operation: "invoices.update",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanMutateInvoices(ctxFor(actor));
    },
  },
  {
    id: "invoices.get",
    operation: "invoices.get",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanReadInvoices(ctxFor(actor));
    },
  },
  {
    id: "steps.complete",
    operation: "steps.complete",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      // Step completion also checks allowed_role per step; matrix gates signed-in roles.
      requireRole(ctxFor(actor), "admin", "builder", "viewer");
    },
  },

  // --- B6 documents ---
  {
    id: "documents.upload",
    operation: "documents.upload",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanUploadDocuments(ctxFor(actor));
    },
  },
  {
    id: "documents.download",
    operation: "documents.download",
    expectations: {
      "signed-out": "deny",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      assertCanDownloadDocuments(ctxFor(actor));
    },
  },

  // --- B7 overview / delete lifecycle ---
  {
    id: "invoices.list",
    operation: "invoices.list",
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
    id: "dashboard.read",
    operation: "dashboard.counts/byStep/needsAttention/recentActivity",
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
    id: "history.forInvoice",
    operation: "history.forInvoice",
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
    id: "reminders.compute",
    operation: "reminders.compute/dismiss",
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
    id: "invoices.softDelete",
    operation: "invoices.softDelete",
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
    id: "invoices.undo",
    operation: "invoices.undo / listDeleted",
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

  // --- B8 company profile + banks ---
  {
    id: "company.get",
    operation: "company.get",
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
    id: "company.update",
    operation: "company.update",
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
    id: "company.listBanks",
    operation: "company.listBanks",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "allow",
      admin: "allow",
    },
    run(actor) {
      requireRole(ctxFor(actor), "admin", "builder");
    },
  },
  {
    id: "company.mutateBanks",
    operation: "company.addBank/editBank/deactivateBank/setDefaultBank",
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
    id: "company.summary",
    operation: "company.summary",
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

  // --- B7 health + cron / jobs ---
  {
    id: "health.check",
    operation: "health.check / GET /api/health (public)",
    expectations: {
      "signed-out": "allow",
      viewer: "allow",
      builder: "allow",
      admin: "allow",
    },
    run() {
      // Public smoke endpoint; no requireRole.
    },
  },
  {
    id: "cron.purge",
    operation: "GET/POST /api/cron/purge (CRON_SECRET, not role)",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "deny",
    },
    run() {
      // Role is irrelevant — missing secret always denies.
      requireCronSecret(new Request("http://localhost/api/cron/purge"), {
        secret: "matrix-cron-secret",
      });
    },
  },
  {
    id: "cron.reminders",
    operation: "GET/POST /api/cron/reminders (CRON_SECRET, not role)",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "deny",
    },
    run() {
      requireCronSecret(new Request("http://localhost/api/cron/reminders"), {
        secret: "matrix-cron-secret",
      });
    },
  },
  {
    id: "jobs.purge",
    operation: "jobs.runPurge (cron system admin context)",
    expectations: {
      "signed-out": "deny",
      viewer: "deny",
      builder: "deny",
      admin: "allow",
    },
    run(actor) {
      // Service is invoked by cron with an admin RequestContext.
      requireRole(ctxFor(actor), "admin");
    },
  },
];
