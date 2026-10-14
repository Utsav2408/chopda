/**
 * Single audit writer (B2-07). Always same-transaction as the mutating work.
 * Redacts secret fields in before/after JSON before insert.
 */
import { redactSecrets } from "../kernel/logger.js";
import { auditLog } from "../db/schema.js";
import type { AppTx } from "../db/client.js";
import type { RequestContext } from "../db/with-user.js";

export type AuditInput = {
  tx: AppTx;
  ctx: RequestContext;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

/** Extra keys beyond the logger's set — audit payloads often carry hashes. */
const EXTRA_SENSITIVE = new Set(
  [
    "passwordhash",
    "tokenhash",
    "password_hash",
    "token_hash",
    "ifsc",
    "accountnumberencrypted",
    "ifscencrypted",
    "panencrypted",
    "pan_encrypted",
    "account_number_encrypted",
    "ifsc_encrypted",
  ].map((k) => k.toLowerCase()),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Redact secrets for audit JSON (logger redaction + a few audit-specific keys).
 * Exported for unit tests.
 */
export function redactForAudit(value: unknown): unknown {
  const base = redactSecrets(value);
  return redactExtra(base);
}

function redactExtra(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactExtra);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (EXTRA_SENSITIVE.has(key.toLowerCase())) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactExtra(nested);
      }
    }
    return out;
  }
  return value;
}

/** Insert one audit_log row. Secrets in before/after are redacted. */
export async function audit(input: AuditInput): Promise<void> {
  const before =
    input.before === undefined ? null : (redactForAudit(input.before) as Record<string, unknown>);
  const after =
    input.after === undefined ? null : (redactForAudit(input.after) as Record<string, unknown>);

  await input.tx.insert(auditLog).values({
    actorId: input.ctx.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before,
    after,
    requestId: input.ctx.requestId,
  });
}
