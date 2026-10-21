/**
 * Thin handlers for flow operations (B4-10). Map Zod + AppError to HTTP-shaped
 * results. Server actions / route handlers call these; they never touch SQL.
 */
import { ZodError } from "zod";
import type { AuthContext } from "../authz/index.js";
import {
  Conflict,
  Forbidden,
  Internal,
  NotFound,
  RateLimited,
  Unauthenticated,
  Validation,
  type AppError,
} from "../kernel/errors.js";
import * as flows from "./service.js";
import {
  createDraftInputSchema,
  flowStepInputSchema,
  type CreateDraftInput,
  type FlowStepInput,
} from "./schema.js";

export type HandlerResult<T = unknown> = {
  status: number;
  body: T | { error: string; code: string };
};

function isAppError(err: unknown): err is AppError {
  return (
    err instanceof Unauthenticated ||
    err instanceof Forbidden ||
    err instanceof NotFound ||
    err instanceof Validation ||
    err instanceof Conflict ||
    err instanceof RateLimited ||
    err instanceof Internal
  );
}

export function mapErrorToHandlerResult(err: unknown): HandlerResult {
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? "Validation failed";
    return { status: 400, body: { error: message, code: "Validation" } };
  }
  if (isAppError(err)) {
    const status =
      err.code === "Unauthenticated"
        ? 401
        : err.code === "Forbidden" || err.code === "NotFound"
          ? 404
          : err.code === "Validation"
            ? 400
            : err.code === "Conflict"
              ? 409
              : err.code === "RateLimited"
                ? 429
                : 500;
    return { status, body: { error: err.message, code: err.code } };
  }
  return { status: 500, body: { error: "Internal error", code: "Internal" } };
}

async function wrap<T>(fn: () => Promise<T>, successStatus = 200): Promise<HandlerResult<T>> {
  try {
    const value = await fn();
    return { status: successStatus, body: value };
  } catch (err) {
    return mapErrorToHandlerResult(err) as HandlerResult<T>;
  }
}

export function handleCreateDraft(ctx: AuthContext, body: unknown) {
  return wrap(async () => {
    const input: CreateDraftInput = createDraftInputSchema.parse(body);
    return flows.createDraft(ctx, input);
  }, 201);
}

export function handleDuplicate(ctx: AuthContext, flowId: string) {
  return wrap(() => flows.duplicate(ctx, flowId), 201);
}

export function handleAddStep(ctx: AuthContext, flowId: string, body: unknown) {
  return wrap(async () => {
    const input: FlowStepInput = flowStepInputSchema.parse(body);
    return flows.addStep(ctx, flowId, input);
  });
}

export function handleEditStep(ctx: AuthContext, flowId: string, stepId: string, body: unknown) {
  return wrap(async () => {
    const patch = flowStepInputSchema.partial().parse(body);
    return flows.editStep(ctx, flowId, stepId, patch);
  });
}

export function handleRemoveStep(ctx: AuthContext, flowId: string, stepId: string) {
  return wrap(() => flows.removeStep(ctx, flowId, stepId));
}

export function handleReorderSteps(ctx: AuthContext, flowId: string, body: unknown) {
  return wrap(async () => {
    const orderedStepIds = (body as { orderedStepIds?: unknown })?.orderedStepIds;
    if (!Array.isArray(orderedStepIds) || !orderedStepIds.every((id) => typeof id === "string")) {
      throw new Validation("orderedStepIds must be a string array");
    }
    return flows.reorderSteps(ctx, flowId, orderedStepIds);
  });
}

export function handlePublish(ctx: AuthContext, flowId: string) {
  return wrap(() => flows.publish(ctx, flowId));
}

export function handleArchive(ctx: AuthContext, flowId: string) {
  return wrap(() => flows.archive(ctx, flowId));
}

export function handleUnarchive(ctx: AuthContext, flowId: string) {
  return wrap(() => flows.unarchive(ctx, flowId));
}

export function handleList(ctx: AuthContext) {
  return wrap(() => flows.list(ctx));
}

export function handleGet(ctx: AuthContext, flowId: string) {
  return wrap(() => flows.get(ctx, flowId));
}

export function handleDiffAgainst(ctx: AuthContext, flowId: string, otherFlowId: string) {
  return wrap(() => flows.diffAgainst(ctx, flowId, otherFlowId));
}
