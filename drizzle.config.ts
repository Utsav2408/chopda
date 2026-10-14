import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. Migrations use DATABASE_URL_DIRECT (non-pooled).
 * Runtime app connections should eventually use a limited `app_user` role
 * via DATABASE_URL — see db/migrations/README.md.
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
