/**
 * Field encryption (B2-04): AES-256-GCM, unique nonce per value, key-id prefix.
 * Decrypt only in server code. Key material is derived from ENCRYPTION_KEY
 * (SHA-256 → 32 bytes) unless a key buffer is passed for tests.
 *
 * Ciphertext wire format: `<keyId>:<base64url(nonce)>:<base64url(ciphertext||tag)>`
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Internal, Validation } from "../kernel/errors.js";

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const DEFAULT_KEY_ID = "v1";

export type EncryptionKey = {
  keyId: string;
  key: Buffer;
};

/** Derive a 32-byte AES key from an env string (or pass-through if already 32 bytes). */
export function deriveKeyFromSecret(secret: string, keyId: string = DEFAULT_KEY_ID): EncryptionKey {
  if (!secret || secret.length === 0) {
    throw new Internal("ENCRYPTION_KEY is empty");
  }
  const key = createHash("sha256").update(secret, "utf8").digest();
  if (key.length !== KEY_BYTES) {
    throw new Internal("Failed to derive AES-256 key");
  }
  return { keyId, key };
}

/** Resolve key from ENCRYPTION_KEY env, or use an injected key for tests. */
export function resolveEncryptionKey(opts?: {
  envSecret?: string;
  key?: Buffer;
  keyId?: string;
}): EncryptionKey {
  if (opts?.key) {
    if (opts.key.length !== KEY_BYTES) {
      throw new Validation(`Encryption key must be ${KEY_BYTES} bytes`);
    }
    return { keyId: opts.keyId ?? DEFAULT_KEY_ID, key: opts.key };
  }
  const secret = opts?.envSecret ?? process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Internal("ENCRYPTION_KEY is not set");
  }
  return deriveKeyFromSecret(secret, opts?.keyId ?? DEFAULT_KEY_ID);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Encrypt plaintext. Each call uses a fresh nonce.
 * Pass `key` to avoid reading env (tests / rotation).
 */
export function encryptField(
  plaintext: string,
  opts?: { key?: Buffer; keyId?: string; envSecret?: string },
): string {
  const { keyId, key } = resolveEncryptionKey(opts);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) {
    throw new Internal("Unexpected GCM tag length");
  }
  return `${keyId}:${b64url(nonce)}:${b64url(Buffer.concat([ciphertext, tag]))}`;
}

/**
 * Decrypt a value produced by encryptField. Tampered / wrong-key values throw.
 */
export function decryptField(
  packed: string,
  opts?: { key?: Buffer; keyId?: string; envSecret?: string; keysById?: Record<string, Buffer> },
): string {
  const parts = packed.split(":");
  if (parts.length !== 3) {
    throw new Validation("Invalid ciphertext format");
  }
  const [keyId, nonceB64, bodyB64] = parts as [string, string, string];
  if (!keyId || !nonceB64 || !bodyB64) {
    throw new Validation("Invalid ciphertext format");
  }

  let key: Buffer;
  if (opts?.keysById?.[keyId]) {
    key = opts.keysById[keyId]!;
  } else {
    const resolved = resolveEncryptionKey({
      key: opts?.key,
      keyId: opts?.keyId ?? keyId,
      envSecret: opts?.envSecret,
    });
    key = resolved.key;
  }

  const nonce = fromB64url(nonceB64);
  if (nonce.length !== NONCE_BYTES) {
    throw new Validation("Invalid nonce");
  }
  const body = fromB64url(bodyB64);
  if (body.length < TAG_BYTES) {
    throw new Validation("Invalid ciphertext");
  }
  const ciphertext = body.subarray(0, body.length - TAG_BYTES);
  const tag = body.subarray(body.length - TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGO, key, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new Validation("Decryption failed");
  }
}

/** Parse the key id prefix without decrypting. */
export function ciphertextKeyId(packed: string): string | null {
  const idx = packed.indexOf(":");
  if (idx <= 0) return null;
  return packed.slice(0, idx);
}
