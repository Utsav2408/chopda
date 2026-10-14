import { isAbsolute } from "node:path";
import { z } from "zod";

/**
 * Zod-validated process env (B0-10). Refuses boot on missing/malformed vars.
 *
 * Does not import "server-only" so Node scripts (migrate, bootstrap, smoke) can
 * call loadEnv(). App code should prefer importing via `src/server/index.ts`.
 *
 * CLOUDFLARE_API_TOKEN and other CLOUDFLARE_* setup tokens are intentionally
 * not part of app env — they are owner/setup-only and must not be loaded here.
 */

const storageProviderSchema = z.enum(["local", "r2"]);

const envShape = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_DIRECT: z.string().min(1, "DATABASE_URL_DIRECT is required"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  STORAGE_PROVIDER: storageProviderSchema,
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1).optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).optional(),
  FILE_STORAGE_DIR: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
});

const envSchema = envShape.superRefine((data, ctx) => {
  if (data.STORAGE_PROVIDER === "local") {
    if (!data.FILE_STORAGE_DIR || data.FILE_STORAGE_DIR.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["FILE_STORAGE_DIR"],
        message: "FILE_STORAGE_DIR is required when STORAGE_PROVIDER=local (absolute path)",
      });
    } else if (!isAbsolute(data.FILE_STORAGE_DIR)) {
      ctx.addIssue({
        code: "custom",
        path: ["FILE_STORAGE_DIR"],
        message: "FILE_STORAGE_DIR must be an absolute path when STORAGE_PROVIDER=local",
      });
    }
  }

  if (data.STORAGE_PROVIDER === "r2") {
    const requiredR2 = [
      "R2_ACCOUNT_ID",
      "R2_BUCKET",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ] as const;
    for (const key of requiredR2) {
      const value = data[key];
      if (!value || value.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when STORAGE_PROVIDER=r2`,
        });
      }
    }
  }
});

export type AppEnv = z.infer<typeof envShape> & {
  STORAGE_PROVIDER: "local" | "r2";
};

let cached: AppEnv | undefined;

function formatEnvErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

export type EnvSource = Record<string, string | undefined>;

/**
 * Neon `neon env pull` writes `DATABASE_URL` (pooled) and
 * `DATABASE_URL_UNPOOLED` (direct). This app historically uses
 * `DATABASE_URL_DIRECT` for migrations — accept either name.
 */
function resolveDatabaseUrls(source: EnvSource): EnvSource {
  const direct = source.DATABASE_URL_DIRECT || source.DATABASE_URL_UNPOOLED;
  if (!direct) return source;
  return { ...source, DATABASE_URL_DIRECT: direct };
}

/**
 * Parse and validate env from a source object (defaults to process.env).
 * Throws with a clear multi-line message on failure. Does not cache.
 */
export function loadEnv(source: EnvSource = process.env): AppEnv {
  const parsed = envSchema.safeParse(resolveDatabaseUrls(source));
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration — refusing to boot:\n${formatEnvErrors(parsed.error)}`,
    );
  }
  return parsed.data;
}

/**
 * Cached env for the process lifetime. First call runs loadEnv(); later calls
 * return the same object. Use resetEnvCache() in tests.
 */
export function getEnv(): AppEnv {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

/** Clear the getEnv() cache (tests only). */
export function resetEnvCache(): void {
  cached = undefined;
}
