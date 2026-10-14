import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  hashPassword,
  needsRehash,
  verifyPassword,
  ARGON2_OPTIONS,
  PASSWORD_MIN_LENGTH,
} from "../../../src/server/security/password.js";
import { Validation } from "../../../src/server/kernel/errors.js";
import * as argon2 from "argon2";

describe("password module (B2-01)", () => {
  it(`rejects passwords shorter than ${PASSWORD_MIN_LENGTH}`, async () => {
    await expect(hashPassword("short")).rejects.toBeInstanceOf(Validation);
  });

  it("hash differs per call (unique salt)", async () => {
    const password = "long-enough-dev-password";
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    expect(a).not.toBe(b);
    expect(await verifyPassword(password, a)).toBe(true);
    expect(await verifyPassword(password, b)).toBe(true);
  });

  it("wrong password fails verify", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("wrong-password-here", hash)).toBe(false);
  });

  it("needsRehash is false for current parameters", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(needsRehash(hash)).toBe(false);
  });

  it("needsRehash is true when parameters differ", async () => {
    const weak = await argon2.hash("correct-horse-battery", {
      type: argon2.argon2id,
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
    expect(needsRehash(weak)).toBe(true);
    expect(ARGON2_OPTIONS.type).toBe(argon2.argon2id);
  });

  it("constantTimeEqual matches equal strings and rejects unequal", () => {
    expect(constantTimeEqual("token-abc", "token-abc")).toBe(true);
    expect(constantTimeEqual("token-abc", "token-xyz")).toBe(false);
    expect(constantTimeEqual("short", "longer-value")).toBe(false);
  });
});
