import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { resolveTestDatabaseUrl, setupTestDatabase, teardown, withClient } from "./harness.js";

const connectionString = resolveTestDatabaseUrl();

describe.skipIf(!connectionString)("db harness placeholder", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await setupTestDatabase(connectionString);
  });

  afterAll(async () => {
    await teardown(pool);
  });

  it("can SELECT 1", async () => {
    const row = await withClient(pool, async (client) => {
      const result = await client.query<{ ok: number }>("SELECT 1 AS ok");
      return result.rows[0];
    });
    expect(row?.ok).toBe(1);
  });
});
