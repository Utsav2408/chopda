#!/usr/bin/env tsx
/**
 * B2-05: Re-encrypt company_profile.pan_encrypted and company_bank_accounts
 * encrypted columns under a new ENCRYPTION_KEY.
 *
 * Usage:
 *   ENCRYPTION_KEY=old NEW_ENCRYPTION_KEY=new pnpm exec tsx scripts/rotate-encryption-key.ts --dry-run
 *   ENCRYPTION_KEY=old NEW_ENCRYPTION_KEY=new pnpm exec tsx scripts/rotate-encryption-key.ts
 *
 * Dry-run lists rows that would be re-encrypted without writing.
 * Without --dry-run, decrypts with ENCRYPTION_KEY and re-encrypts with NEW_ENCRYPTION_KEY.
 */
import "dotenv/config";
import { Pool } from "pg";
import { ciphertextKeyId, decryptField, encryptField } from "../src/server/security/crypto.js";

type RowRef = {
  table: string;
  id: string;
  column: string;
  keyId: string | null;
  preview: string;
};

function isDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

async function listEncryptedRows(pool: Pool): Promise<RowRef[]> {
  const refs: RowRef[] = [];

  const pan = await pool.query<{ id: number; pan_encrypted: string | null }>(
    `SELECT id, pan_encrypted FROM company_profile WHERE pan_encrypted IS NOT NULL`,
  );
  for (const row of pan.rows) {
    if (!row.pan_encrypted) continue;
    refs.push({
      table: "company_profile",
      id: String(row.id),
      column: "pan_encrypted",
      keyId: ciphertextKeyId(row.pan_encrypted),
      preview: `${row.pan_encrypted.slice(0, 24)}…`,
    });
  }

  const banks = await pool.query<{
    id: string;
    account_number_encrypted: string;
    ifsc_encrypted: string;
  }>(`SELECT id, account_number_encrypted, ifsc_encrypted FROM company_bank_accounts`);
  for (const row of banks.rows) {
    refs.push({
      table: "company_bank_accounts",
      id: row.id,
      column: "account_number_encrypted",
      keyId: ciphertextKeyId(row.account_number_encrypted),
      preview: `${row.account_number_encrypted.slice(0, 24)}…`,
    });
    refs.push({
      table: "company_bank_accounts",
      id: row.id,
      column: "ifsc_encrypted",
      keyId: ciphertextKeyId(row.ifsc_encrypted),
      preview: `${row.ifsc_encrypted.slice(0, 24)}…`,
    });
  }

  return refs;
}

async function rotate(pool: Pool, oldSecret: string, newSecret: string): Promise<number> {
  let updated = 0;

  const pan = await pool.query<{ id: number; pan_encrypted: string | null }>(
    `SELECT id, pan_encrypted FROM company_profile WHERE pan_encrypted IS NOT NULL`,
  );
  for (const row of pan.rows) {
    if (!row.pan_encrypted) continue;
    const plain = decryptField(row.pan_encrypted, { envSecret: oldSecret });
    const next = encryptField(plain, { envSecret: newSecret, keyId: "v2" });
    await pool.query(
      `UPDATE company_profile SET pan_encrypted = $1, updated_at = now() WHERE id = $2`,
      [next, row.id],
    );
    updated += 1;
  }

  const banks = await pool.query<{
    id: string;
    account_number_encrypted: string;
    ifsc_encrypted: string;
  }>(`SELECT id, account_number_encrypted, ifsc_encrypted FROM company_bank_accounts`);
  for (const row of banks.rows) {
    const acct = encryptField(
      decryptField(row.account_number_encrypted, { envSecret: oldSecret }),
      {
        envSecret: newSecret,
        keyId: "v2",
      },
    );
    const ifsc = encryptField(decryptField(row.ifsc_encrypted, { envSecret: oldSecret }), {
      envSecret: newSecret,
      keyId: "v2",
    });
    await pool.query(
      `UPDATE company_bank_accounts
       SET account_number_encrypted = $1, ifsc_encrypted = $2, updated_at = now()
       WHERE id = $3`,
      [acct, ifsc, row.id],
    );
    updated += 2;
  }

  return updated;
}

async function main() {
  const dryRun = isDryRun(process.argv);
  const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL_DIRECT (or DATABASE_URL) before rotating keys.");
  }

  const oldSecret = process.env.ENCRYPTION_KEY;
  if (!oldSecret) {
    throw new Error("ENCRYPTION_KEY (current key) is required.");
  }

  const pool = new Pool({ connectionString });
  try {
    const refs = await listEncryptedRows(pool);
    console.log(`[rotate-encryption-key] Found ${refs.length} encrypted field(s).`);
    for (const ref of refs) {
      console.log(
        `  - ${ref.table}.${ref.column} id=${ref.id} keyId=${ref.keyId ?? "?"} ${ref.preview}`,
      );
    }

    if (dryRun) {
      console.log("[rotate-encryption-key] Dry-run only — no rows updated.");
      return;
    }

    const newSecret = process.env.NEW_ENCRYPTION_KEY;
    if (!newSecret) {
      throw new Error("NEW_ENCRYPTION_KEY is required unless --dry-run.");
    }
    if (newSecret === oldSecret) {
      throw new Error("NEW_ENCRYPTION_KEY must differ from ENCRYPTION_KEY.");
    }

    const updated = await rotate(pool, oldSecret, newSecret);
    console.log(`[rotate-encryption-key] Re-encrypted ${updated} field(s).`);
    console.log(
      "[rotate-encryption-key] Update ENCRYPTION_KEY to the new value in all secret stores, then remove NEW_ENCRYPTION_KEY.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[rotate-encryption-key] FAILED:", err);
  process.exit(1);
});
