/**
 * Thin handlers for company profile / bank / summary (B8-04).
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
import {
  addBankAccountSchema,
  editBankAccountSchema,
  updateCompanyProfileSchema,
} from "./schema.js";
import * as company from "./service.js";

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

export function handleGetProfile(ctx: AuthContext) {
  return wrap(() => company.get(ctx));
}

export function handleUpdateProfile(ctx: AuthContext, body: unknown) {
  return wrap(async () => {
    const input = updateCompanyProfileSchema.parse(body);
    return company.update(ctx, input);
  });
}

export function handleSummary(ctx: AuthContext) {
  return wrap(() => company.summary(ctx));
}

export function handleListBanks(ctx: AuthContext) {
  return wrap(() => company.listBanks(ctx));
}

export function handleAddBank(ctx: AuthContext, body: unknown) {
  return wrap(async () => {
    const input = addBankAccountSchema.parse(body);
    return company.addBank(ctx, input);
  }, 201);
}

export function handleEditBank(ctx: AuthContext, id: string, body: unknown) {
  return wrap(async () => {
    const input = editBankAccountSchema.parse(body);
    return company.editBank(ctx, id, input);
  });
}

export function handleDeactivateBank(ctx: AuthContext, id: string) {
  return wrap(() => company.deactivateBank(ctx, id));
}

export function handleSetDefaultBank(ctx: AuthContext, id: string) {
  return wrap(() => company.setDefaultBank(ctx, id));
}
