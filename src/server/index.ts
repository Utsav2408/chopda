import "server-only";

// src/server/** is the only place allowed to talk to the database or the file
// storage adapter. Every module in this tree imports "server-only" (directly or
// transitively through this file) so Next.js fails the build if client-bundled
// code ever imports it — see docs/invoice-tracker-github-repo-checklist.md §6 and
// AGENTS.md "Where things live".
//
// Kernel primitives (errors, Result, request id, logger) and the Zod env loader
// are re-exported here for app/server code (B0-09 / B0-10). Scripts and unit
// tests may import kernel/env modules directly (those files do not import
// "server-only" themselves — same pattern as storage).

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
