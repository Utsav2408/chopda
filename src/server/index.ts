import "server-only";

// src/server/** is the only place allowed to talk to the database or the file
// storage adapter. Every module in this tree imports "server-only" (directly or
// transitively through this file) so Next.js fails the build if client-bundled
// code ever imports it — see docs/invoice-tracker-github-repo-checklist.md §6 and
// AGENTS.md "Where things live".

export const SERVER_ONLY_MARKER = true;

export {
  Unauthenticated,
  Forbidden,
  NotFound,
  Validation,
  Conflict,
  RateLimited,
  Internal,
  type AppError,
  ok,
  err,
  isOk,
  isErr,
  type Ok,
  type Err,
  type Result,
  generateRequestId,
  log,
  redactSecrets,
} from "./kernel/index.js";

export { loadEnv, getEnv, resetEnvCache, type AppEnv } from "./env.js";

export {
  getDb,
  getPool,
  resetDbClient,
  withUser,
  type AppDb,
  type AppTx,
  type RequestContext,
  type UserRole,
} from "./db/index.js";

export {
  hashPassword,
  verifyPassword,
  needsRehash,
  constantTimeEqual,
  generateTemporaryPassword,
  dummyPasswordHash,
  ARGON2_OPTIONS,
  PASSWORD_MIN_LENGTH,
} from "./security/password.js";

export {
  generateSessionToken,
  hashSessionToken,
  isSessionValid,
  sessionCookieFlags,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_MS,
} from "./security/session.js";

export {
  decideLoginRateLimit,
  type LoginRateLimitDecision,
} from "./security/rate-limit.js";

export { encryptField, decryptField } from "./security/crypto.js";

export { assertSameOrigin, assertInputSize, MAX_INPUT_BYTES } from "./security/csrf.js";

export { requireCronSecret } from "./security/cron.js";

export { audit, redactForAudit, type AuditInput } from "./audit/write.js";

export { requireRole, requireStepRole, canSeeInvoice } from "./authz/index.js";
