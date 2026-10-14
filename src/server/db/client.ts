/**
 * Pooled Drizzle client for the app (DATABASE_URL). Migrations use
 * DATABASE_URL_DIRECT via scripts/migrate.ts — never this pool.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "../env.js";
import * as schema from "./schema.js";

export type AppDb = NodePgDatabase<typeof schema>;
export type AppTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

let pool: Pool | undefined;
let db: AppDb | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getEnv().DATABASE_URL });
  }
  return pool;
}

export function getDb(): AppDb {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/** Test helper: drop cached pool/db so the next getDb() reconnects. */
export async function resetDbClient(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  pool = undefined;
  db = undefined;
}
