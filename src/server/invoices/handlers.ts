/**
 * Thin handlers for invoices and steps (B5-09).
 * List / soft-delete / dashboard handlers land with B7.
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
import * as invoices from "./service.js";
import * as steps from "../steps/service.js";
import {
  completeStepInputSchema,
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
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

export function handleCreateInvoice(ctx: AuthContext, body: unknown) {
  return wrap(async () => {
    const input = createInvoiceInputSchema.parse(body);
    return invoices.create(ctx, input);
  }, 201);
}

export function handleUpdateInvoice(ctx: AuthContext, invoiceId: string, body: unknown) {
  return wrap(async () => {
    const input = updateInvoiceInputSchema.parse(body);
    return invoices.update(ctx, invoiceId, input);
  });
}

export function handleGetInvoice(ctx: AuthContext, invoiceId: string) {
  return wrap(() => invoices.get(ctx, invoiceId));
}

export function handleCompleteStep(ctx: AuthContext, body: unknown) {
  return wrap(async () => {
    const input = completeStepInputSchema.parse(body);
    return steps.complete(ctx, input);
  });
}
