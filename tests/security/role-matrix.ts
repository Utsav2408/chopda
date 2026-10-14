/**
 * Declarative role matrix (B2-12). Later phases append rows for each callable
 * service/handler. This PR ships one sample row so the harness runs in CI.
 */
import { Forbidden, Unauthenticated } from "../../src/server/kernel/errors.js";
import { requireRole } from "../../src/server/authz/index.js";
import type { RequestContext, UserRole } from "../../src/server/db/with-user.js";

export type Actor = "signed-out" | "viewer" | "builder" | "admin";

export type Expectation = "allow" | "deny";

export type MatrixRow = {
  id: string;
  operation: string;
  expectations: Record<Actor, Expectation>;
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

export function isDenial(err: unknown): boolean {
  return err instanceof Unauthenticated || err instanceof Forbidden;
}

export const ROLE_MATRIX_EXPECTED_IDS = ["requireRole-admin"] as const;

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
    run: (actor) => {
      const ctx = ctxFor(actor);
      if (!ctx) throw new Unauthenticated();
      requireRole(ctx, "admin");
    },
  },
];
