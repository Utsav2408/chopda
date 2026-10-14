import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findAiViolations } from "../../scripts/check-no-ai-before-phase6.js";

describe("check-no-ai-before-phase6 (B0-08)", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports no violations on a clean tree", async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-no-ai-clean-"));
    await writeFile(join(dir, "readme.txt"), "no ai here\n", "utf8");
    expect(findAiViolations(dir)).toEqual([]);
  });

  it("fails when an agent route path is planted", async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-no-ai-route-"));
    const routeDir = join(dir, "src", "app", "agent");
    await mkdir(routeDir, { recursive: true });
    await writeFile(
      join(routeDir, "page.tsx"),
      "export default function Page() { return null; }\n",
    );

    const violations = findAiViolations(dir);
    expect(violations.some((v) => v.kind === "agent_route")).toBe(true);
  });

  it("fails when an AI vendor key name is planted", async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-no-ai-key-"));
    await writeFile(
      join(dir, "config.ts"),
      "export const k = process.env.OPENAI_API_KEY;\n",
      "utf8",
    );

    const violations = findAiViolations(dir);
    expect(violations.some((v) => v.kind === "ai_vendor_key")).toBe(true);
  });

  it("fails when an agent_* table appears in SQL", async () => {
    dir = await mkdtemp(join(tmpdir(), "chopda-no-ai-table-"));
    const mig = join(dir, "db", "migrations");
    await mkdir(mig, { recursive: true });
    await writeFile(join(mig, "0001.sql"), "CREATE TABLE agent_runs (id uuid);\n", "utf8");

    const violations = findAiViolations(dir);
    expect(violations.some((v) => v.kind === "agent_table")).toBe(true);
  });
});
