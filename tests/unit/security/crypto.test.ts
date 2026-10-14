import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ciphertextKeyId,
  decryptField,
  encryptField,
} from "../../../src/server/security/crypto.js";
import { Validation } from "../../../src/server/kernel/errors.js";

describe("field encryption (B2-04)", () => {
  const key = randomBytes(32);

  it("round-trips plaintext with unique ciphertext per call", () => {
    const a = encryptField("ABCDE1234F", { key, keyId: "v1" });
    const b = encryptField("ABCDE1234F", { key, keyId: "v1" });
    expect(a).not.toBe(b);
    expect(ciphertextKeyId(a)).toBe("v1");
    expect(decryptField(a, { key })).toBe("ABCDE1234F");
    expect(decryptField(b, { key })).toBe("ABCDE1234F");
  });

  it("tampered ciphertext fails", () => {
    const packed = encryptField("secret-bank-value", { key, keyId: "v1" });
    const parts = packed.split(":");
    const body = parts[2]!;
    const flipped = Buffer.from(body, "base64url");
    flipped[0] = flipped[0]! ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${flipped.toString("base64url")}`;
    expect(() => decryptField(tampered, { key })).toThrow(Validation);
  });

  it("wrong key fails", () => {
    const packed = encryptField("pan-value", { key, keyId: "v1" });
    const other = randomBytes(32);
    expect(() => decryptField(packed, { key: other })).toThrow(Validation);
  });

  it("derives from env secret string", () => {
    const packed = encryptField("hello", { envSecret: "dev-only-encryption-secret" });
    expect(decryptField(packed, { envSecret: "dev-only-encryption-secret" })).toBe("hello");
  });
});
