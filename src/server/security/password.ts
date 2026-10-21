/**
 * Password hashing (B2-01): argon2id, minimum length, rehash-on-parameter-change.
 * Constant-time compare for opaque tokens (not for passwords — use verifyPassword).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import { Validation } from "../kernel/errors.js";
import { PASSWORD_MIN_LENGTH } from "./constants.js";

/** Documented argon2id parameters — change carefully; needsRehash detects drift. */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export { PASSWORD_MIN_LENGTH };

function assertMinLength(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Validation(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
}

/** Hash a password with argon2id. Rejects passwords shorter than PASSWORD_MIN_LENGTH. */
export async function hashPassword(password: string): Promise<string> {
  assertMinLength(password);
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** Verify a password against an argon2id hash. Returns false on mismatch or bad hash. */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * True when the stored hash was produced with different parameters than
 * ARGON2_OPTIONS (or is not argon2id). Callers should re-hash and persist.
 */
export function needsRehash(passwordHash: string): boolean {
  try {
    return argon2.needsRehash(passwordHash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}

/**
 * Constant-time equality for opaque tokens / secrets of any string length.
 * Hashes both sides with SHA-256 first so length differences do not leak.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const digA = createHash("sha256").update(a, "utf8").digest();
  const digB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digA, digB);
}

/**
 * One-time temporary password (admin reset / user create). Long enough for
 * PASSWORD_MIN_LENGTH; caller must force must_change_password and show once.
 */
export function generateTemporaryPassword(): string {
  return randomBytes(24).toString("base64url");
}

/** Lazy dummy argon2id hash so unknown-user login still runs verifyPassword. */
let cachedDummyHash: string | undefined;

export async function dummyPasswordHash(): Promise<string> {
  if (!cachedDummyHash) {
    cachedDummyHash = await hashPassword("timing-safe-dummy-password");
  }
  return cachedDummyHash;
}
