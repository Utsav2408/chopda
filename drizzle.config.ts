import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. Migrations use the direct (non-pooled) URL:
 * DATABASE_URL_DIRECT or Neon's DATABASE_URL_UNPOOLED.
 * Runtime app connections use pooled DATABASE_URL — see db/migrations/README.md.
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_DIRECT ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "",
  },
  strict: true,
  verbose: true,
});
