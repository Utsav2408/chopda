/**
 * DB module barrel (B1). Schema is safe for scripts; pooled client is for
 * server code (prefer importing via src/server/index.ts from the app).
 * `withUser` lands in B2-06.
 */
export * from "./schema.js";
export { getDb, getPool, resetDbClient, type AppDb, type AppTx } from "./client.js";
