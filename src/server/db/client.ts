/**
 * Pooled Drizzle client for the app (DATABASE_URL). Migrations use
 * DATABASE_URL_DIRECT / DATABASE_URL_UNPOOLED via scripts/migrate.ts —
 * never this pool.
 *
 * On Vercel Fluid Compute, node-postgres + attachDatabasePool is the
 * Neon-recommended pairing (see neon-postgres skill).
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "../env.js";
import * as schema from "./schema.js";

export type AppDb = NodePgDatabase<typeof schema>;
export type AppTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

let pool: Pool | undefined;
let db: AppDb | undefined;
let vercelPoolAttached = false;

export function getPool(): Pool {
  if (!pool) {
    // Keep max modest: Fluid reuses isolates; each isolate holds its own pool.
    pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 10 });
    if (process.env.VERCEL && !vercelPoolAttached) {
      vercelPoolAttached = true;
      void import("@vercel/functions").then(({ attachDatabasePool }) => {
        if (pool) attachDatabasePool(pool);
      });
    }
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
