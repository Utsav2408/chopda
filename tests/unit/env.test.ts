import { afterEach, describe, expect, it } from "vitest";
import { getEnv, loadEnv, resetEnvCache, type EnvSource } from "../../src/server/env.js";

function baseLocalEnv(overrides: EnvSource = {}): EnvSource {
  return {
    DATABASE_URL: "postgres://user:pass@localhost:5432/chopda_dev",
    DATABASE_URL_DIRECT: "postgres://user:pass@localhost:5432/chopda_dev",
    SESSION_SECRET: "dev-session-secret-value-long-enough",
    ENCRYPTION_KEY: "dev-encryption-key-value-long-enough",
    STORAGE_PROVIDER: "local",
    FILE_STORAGE_DIR: "/tmp/chopda-storage-test",
    CRON_SECRET: "dev-cron-secret-value",
    ...overrides,
  };
}

describe("loadEnv (B0-10)", () => {
  afterEach(() => {
    resetEnvCache();
  });

  it("loads a good local env", () => {
    const env = loadEnv(baseLocalEnv());
    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.FILE_STORAGE_DIR).toBe("/tmp/chopda-storage-test");
    expect(env.DATABASE_URL).toContain("postgres://");
  });

  it("fails clearly when required vars are missing", () => {
    expect(() => loadEnv({})).toThrow(/Invalid environment configuration/);
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it("accepts Neon DATABASE_URL_UNPOOLED as DATABASE_URL_DIRECT", () => {
    const env = loadEnv(
      baseLocalEnv({
        DATABASE_URL_DIRECT: undefined,
        DATABASE_URL_UNPOOLED: "postgres://user:pass@ep-xxx.neon.tech/neondb",
      }),
    );
    expect(env.DATABASE_URL_DIRECT).toContain("neon.tech");
  });

  it("fails when STORAGE_PROVIDER=local without FILE_STORAGE_DIR", () => {
    expect(() =>
      loadEnv(
        baseLocalEnv({
          FILE_STORAGE_DIR: undefined,
        }),
      ),
    ).toThrow(/FILE_STORAGE_DIR is required when STORAGE_PROVIDER=local/);
  });

  it("fails when FILE_STORAGE_DIR is not absolute", () => {
    expect(() =>
      loadEnv(
        baseLocalEnv({
          FILE_STORAGE_DIR: "relative/path",
        }),
      ),
    ).toThrow(/absolute path/);
  });

  it("fails when STORAGE_PROVIDER=r2 without R2 keys", () => {
    expect(() =>
      loadEnv(
        baseLocalEnv({
          STORAGE_PROVIDER: "r2",
          FILE_STORAGE_DIR: undefined,
        }),
      ),
    ).toThrow(/R2_ACCOUNT_ID is required when STORAGE_PROVIDER=r2/);
  });

  it("loads a good r2 env", () => {
    const env = loadEnv(
      baseLocalEnv({
        STORAGE_PROVIDER: "r2",
        FILE_STORAGE_DIR: undefined,
        R2_ACCOUNT_ID: "account-id",
        R2_BUCKET: "chopda-docs",
        R2_ACCESS_KEY_ID: "access-key",
        R2_SECRET_ACCESS_KEY: "secret-key",
      }),
    );
    expect(env.STORAGE_PROVIDER).toBe("r2");
    expect(env.R2_BUCKET).toBe("chopda-docs");
  });

  it("getEnv caches after first successful load", () => {
    const first = loadEnv(baseLocalEnv());
    // Seed cache via getEnv by temporarily setting process.env is awkward;
    // call loadEnv then manually verify reset + getEnv against process.env.
    resetEnvCache();
    const prev = { ...process.env };
    Object.assign(process.env, baseLocalEnv());
    try {
      const a = getEnv();
      const b = getEnv();
      expect(a).toBe(b);
      expect(a.STORAGE_PROVIDER).toBe("local");
      expect(first.STORAGE_PROVIDER).toBe("local");
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in prev)) delete process.env[key];
      }
      Object.assign(process.env, prev);
      resetEnvCache();
    }
  });
});
