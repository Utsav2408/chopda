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
  createSession,
  revokeSession,
  revokeAllSessionsForUser,
  resolveSession as resolveSessionToken,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_MS,
  type SessionRow,
  type SessionCookieFlags,
} from "./security/session.js";

export {
  decideLoginRateLimit,
  checkLoginRateLimit,
  recordLoginAttempt,
  LOGIN_LOCKOUT_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS_PER_USERNAME,
  LOGIN_MAX_ATTEMPTS_PER_IP,
  type LoginRateLimitDecision,
  type LoginAttemptCounts,
} from "./security/rate-limit.js";

export {
  encryptField,
  decryptField,
  deriveKeyFromSecret,
  resolveEncryptionKey,
  ciphertextKeyId,
  type EncryptionKey,
} from "./security/crypto.js";

export { assertSameOrigin, assertInputSize, MAX_INPUT_BYTES } from "./security/csrf.js";

export { requireCronSecret } from "./security/cron.js";

export {
  EXPECTED_SECURITY_HEADERS,
  CONTENT_SECURITY_POLICY,
  securityHeadersForNextConfig,
} from "./security/headers.js";

export { audit, redactForAudit, type AuditInput } from "./audit/write.js";

export {
  requireRole,
  requireStepRole,
  canSeeInvoice,
  type AuthContext,
  type InvoiceVisibility,
} from "./authz/index.js";

export {
  login,
  logout,
  logoutAll,
  resolveSession,
  listOwnSessions,
  revokeOwnSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuthedRequest,
  type LoginInput,
  type LoginResult,
  type PublicAuthUser,
  type ResolvedSession,
} from "./auth/index.js";

export {
  create as createUser,
  list as listUsers,
  get as getUser,
  deactivate as deactivateUser,
  reactivate as reactivateUser,
  resetPassword,
  changeOwnPassword,
  transferAdmin,
  getOwnProfile,
  updateOwnProfile,
  type VisibleUser,
  type CreateUserResult,
} from "./users/index.js";

export { jsonError } from "./http/map-error.js";

export {
  assertCanMutateFlows,
  assertCanReadFlows,
  createDraft,
  duplicate,
  addStep,
  editStep,
  removeStep,
  reorderSteps,
  publish,
  archive,
  canStartNewInvoices,
  assertCanStartNewInvoices,
  list as listFlows,
  get as getFlow,
  diffAgainst,
  validateStepData,
  flowFieldsSchema,
  seedStandardAndCourierFlows,
  handleCreateDraft,
  handlePublish,
  handleArchive,
  handleList,
  handleGet,
  type FlowDetail,
  type FlowListItem,
  type FlowDiff,
  type FlowFields,
} from "./flows/index.js";

export {
  createLocalStorageAdapter,
  getStorageAdapter,
  toObjectKey,
  DOCUMENTS_KEY_PREFIX,
  validateUpload,
  findDuplicateByHash,
  MAX_UPLOAD_BYTES,
  type StorageAdapter,
} from "./storage/index.js";
