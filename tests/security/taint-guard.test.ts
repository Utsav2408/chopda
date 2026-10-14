/**
 * B8-05: Guard against repos / service DTOs leaking password hashes or
 * ciphertext columns to clients.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VisibleUser } from "../../src/server/users/service.js";
import type { BankAccountView, CompanyProfileView } from "../../src/server/company/service.js";

const ROOT = join(import.meta.dirname, "../../src/server");

/** Snake_case / alias names that must never appear in client payloads. */
const FORBIDDEN_CLIENT_KEYS = [
  "password_hash",
  "passwordHash",
  "pan_ciphertext",
  "pan_encrypted",
  "panEncrypted",
  "account_number_ciphertext",
  "account_number_encrypted",
  "accountNumberEncrypted",
  "ifsc_encrypted",
  "ifscEncrypted",
] as const;

/**
 * Careless patterns in repo helpers: selecting / returning ciphertext under
 * the wrong alias names, or bare select-* that would ship hash/ciphertext.
 */
const FORBIDDEN_REPO_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "pan_ciphertext", re: /pan_ciphertext/ },
  { name: "account_number_ciphertext", re: /account_number_ciphertext/ },
  // Bare select-all on sensitive tables (must use explicit column lists).
  {
    name: "select().from(users) without columns",
    re: /\.select\(\s*\)\s*\.from\(\s*users\s*\)/,
  },
  {
    name: "select().from(companyProfile) without columns",
    re: /\.select\(\s*\)\s*\.from\(\s*companyProfile\s*\)/,
  },
  {
    name: "select().from(companyBankAccounts) without columns",
    re: /\.select\(\s*\)\s*\.from\(\s*companyBankAccounts\s*\)/,
  },
];

function listRepoFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listRepoFiles(full));
    } else if (name === "repo.ts") {
      out.push(full);
    }
  }
  return out;
}

function assertNoForbiddenKeys(label: string, value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of FORBIDDEN_CLIENT_KEYS) {
    expect(json, `${label} must not contain ${key}`).not.toContain(`"${key}"`);
  }
}

describe("taint guard (B8-05)", () => {
  it("scans src/server/**/repo.ts for forbidden ciphertext / careless select patterns", () => {
    const repos = listRepoFiles(ROOT);
    expect(repos.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of repos) {
      const src = readFileSync(file, "utf8");
      // Strip line comments so documented field names in comments don't fail.
      const code = src.replace(/\/\/.*$/gm, "");
      for (const { name, re } of FORBIDDEN_REPO_PATTERNS) {
        if (re.test(code)) {
          violations.push(`${file}: ${name}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("company + user service DTOs exclude hash and ciphertext fields", () => {
    const profile: CompanyProfileView = {
      legalName: "Chopda Trading",
      gstin: "22AAAAA0000A1Z5",
      pan: "ABCDE1234F",
      invoiceDefaults: {},
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const bank: BankAccountView = {
      id: "55555555-5555-4555-8555-555555555555",
      label: "Ops",
      bankName: "State Bank",
      accountHolder: "Chopda Trading",
      branch: null,
      accountNumber: "1234567890",
      ifsc: "SBIN0001234",
      isDefault: true,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const user: VisibleUser = {
      id: "33333333-3333-4333-8333-333333333333",
      username: "admin",
      role: "admin",
      isActive: true,
      displayName: "Admin",
      email: null,
      phone: null,
      photoObjectKey: null,
      mustChangePassword: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    assertNoForbiddenKeys("CompanyProfileView", profile);
    assertNoForbiddenKeys("BankAccountView", bank);
    assertNoForbiddenKeys("VisibleUser", user);

    for (const key of Object.keys(profile)) {
      expect(FORBIDDEN_CLIENT_KEYS).not.toContain(key);
    }
    for (const key of Object.keys(bank)) {
      expect(FORBIDDEN_CLIENT_KEYS).not.toContain(key);
    }
    for (const key of Object.keys(user)) {
      expect(FORBIDDEN_CLIENT_KEYS).not.toContain(key);
    }
  });

  it("company repo uses explicit column selects (no bare select *)", () => {
    const companyRepo = readFileSync(join(ROOT, "company/repo.ts"), "utf8");
    expect(companyRepo).toMatch(/panEncrypted:\s*companyProfile\.panEncrypted/);
    expect(companyRepo).toMatch(
      /accountNumberEncrypted:\s*companyBankAccounts\.accountNumberEncrypted/,
    );
    expect(companyRepo).not.toMatch(/\.select\(\s*\)\s*\.from\(/);
  });
});
