/**
 * DB module barrel. Schema is safe for scripts; pooled client + withUser
 * are for server code (prefer importing via src/server/index.ts from the app).
 */
export * from "./schema.js";
export { getDb, getPool, resetDbClient, type AppDb, type AppTx } from "./client.js";
export { withUser, type RequestContext, type UserRole } from "./with-user.js";
