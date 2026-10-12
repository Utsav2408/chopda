#!/usr/bin/env tsx
// Thin wrapper around drizzle-kit migrate so `pnpm db:migrate` always uses the
// DIRECT (non-pooled) connection string, never the pooled DATABASE_URL (plan §5:
// "Production migrations run only from main... using the direct connection
// string; the app uses the pooled one.").
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL_DIRECT (or DATABASE_URL) before running migrations.");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("[migrate] applying pending migrations from db/migrations …");
  await migrate(db, { migrationsFolder: "db/migrations" });
  console.log("[migrate] done.");

  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
