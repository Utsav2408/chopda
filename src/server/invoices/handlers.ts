/**
 * Thin handlers for invoices and steps (B5-09).
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
import * as listService from "./list.js";
import * as lifecycle from "./lifecycle.js";
import * as steps from "../steps/service.js";
import * as dashboard from "../dashboard/index.js";
import * as history from "../history/index.js";
import * as reminders from "../reminders/index.js";
import {
  completeStepInputSchema,
  createInvoiceInputSchema,
  listInvoicesQuerySchema,
  updateInvoiceInputSchema,
} from "./schema.js";
import { z } from "zod";

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

export function handleListInvoices(ctx: AuthContext, query: unknown) {
  return wrap(async () => {
    const input = listInvoicesQuerySchema.parse(query);
    return listService.list(ctx, input);
  });
}

export function handleSoftDeleteInvoice(ctx: AuthContext, invoiceId: string) {
  return wrap(() => lifecycle.softDelete(ctx, invoiceId));
}

export function handleUndoInvoice(ctx: AuthContext, invoiceId: string) {
  return wrap(() => lifecycle.undo(ctx, invoiceId));
}

export function handleListDeletedInvoices(ctx: AuthContext) {
  return wrap(() => lifecycle.listDeleted(ctx));
}

export function handleDashboardCounts(ctx: AuthContext) {
  return wrap(() => dashboard.counts(ctx));
}

export function handleDashboardByStep(ctx: AuthContext) {
  return wrap(() => dashboard.byStep(ctx));
}

export function handleDashboardNeedsAttention(ctx: AuthContext) {
  return wrap(() => dashboard.needsAttention(ctx));
}

export function handleDashboardRecentActivity(ctx: AuthContext) {
  return wrap(() => dashboard.recentActivity(ctx));
}

export function handleInvoiceHistory(ctx: AuthContext, invoiceId: string) {
  return wrap(() => history.forInvoice(ctx, invoiceId));
}

export function handleReminders(ctx: AuthContext) {
  return wrap(() => reminders.compute(ctx));
}

export function handleDismissReminder(ctx: AuthContext, body: unknown) {
  return wrap(async () => {
    const input = z.object({ key: z.string().min(1) }).parse(body);
    await reminders.dismiss(ctx, input.key);
    return { ok: true as const };
  });
}
