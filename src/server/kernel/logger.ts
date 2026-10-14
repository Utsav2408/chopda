/**
 * Structured logger that redacts secrets/PII before JSON output (B0-09).
 * Key match is case-insensitive on the field name.
 */

const REDACTED = "[REDACTED]";

const SENSITIVE_KEYS = new Set(
  [
    "password",
    "token",
    "secret",
    "authorization",
    "pan",
    "accountNumber",
    "cookie",
    "encryptionKey",
  ].map((k) => k.toLowerCase()),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-clone a payload, replacing sensitive field values with [REDACTED]. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = redactSecrets(nested);
      }
    }
    return out;
  }
  return value;
}

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, message: string, payload?: unknown): void {
  const entry: Record<string, unknown> = {
    level,
    message,
    at: new Date().toISOString(),
  };
  if (payload !== undefined) {
    entry.data = redactSecrets(payload);
  }
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const log = {
  info(message: string, payload?: unknown): void {
    emit("info", message, payload);
  },
  warn(message: string, payload?: unknown): void {
    emit("warn", message, payload);
  },
  error(message: string, payload?: unknown): void {
    emit("error", message, payload);
  },
};
