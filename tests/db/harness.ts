import { readdirSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";

const MIGRATIONS_FOLDER = "db/migrations";

/** Prefer TEST_DATABASE_URL, then DATABASE_URL_DIRECT, then DATABASE_URL. */
export function resolveTestDatabaseUrl(): string | undefined {
  return (
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL
  );
}

export function hasSqlMigrations(migrationsFolder = MIGRATIONS_FOLDER): boolean {
  try {
    const entries = readdirSync(migrationsFolder, { withFileTypes: true });
    return entries.some(
      (entry) =>
        entry.isFile() && entry.name.endsWith(".sql") && entry.name.toLowerCase() !== "readme.sql",
    );
  } catch {
    return false;
  }
}

/**
 * Ensure the database named in the connection URL exists.
 * Connects to the `postgres` maintenance DB when the target DB is missing.
 */
export async function ensureDatabaseExists(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("Test database URL must include a database name.");
  }

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  try {
    const result = await adminPool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [dbName],
    );
    if (!result.rows[0]?.exists) {
      // Identifiers cannot be parameterized; dbName comes from our test URL only.
      await adminPool.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function connect(connectionString: string): Promise<Pool> {
  const pool = new Pool({ connectionString });
  // Fail fast if the server is unreachable.
  const client = await pool.connect();
  client.release();
  return pool;
}

/**
 * Apply drizzle migrations when the folder has at least one `.sql` file
 * (B1+). Empty (or README-only) folders are a no-op — drizzle migrate without
 * a journal fails, and B0-14 only needed a live connection.
 */
export async function runMigrations(
  pool: Pool,
  migrationsFolder = MIGRATIONS_FOLDER,
): Promise<"applied" | "skipped"> {
  if (!hasSqlMigrations(migrationsFolder)) {
    return "skipped";
  }
  const db = drizzle(pool);
  // Always migrate when SQL exists (idempotent via drizzle.__drizzle_migrations).
  await migrate(db, { migrationsFolder: join(migrationsFolder) });
  return "applied";
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function teardown(pool: Pool): Promise<void> {
  await pool.end();
}

/**
 * Connect, optionally create the DB, optionally migrate, return a ready pool.
 * Caller must `teardown(pool)` when finished.
 */
export async function setupTestDatabase(connectionString?: string): Promise<Pool> {
  const url = connectionString ?? resolveTestDatabaseUrl();
  if (!url) {
    throw new Error("Set TEST_DATABASE_URL, DATABASE_URL_DIRECT, or DATABASE_URL for DB tests.");
  }
  await ensureDatabaseExists(url);
  const pool = await connect(url);
  await runMigrations(pool);
  return pool;
}
