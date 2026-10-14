import { describe, expect, it } from "vitest";
import { redactForAudit } from "../../../src/server/audit/write.js";

describe("audit redaction (B2-07)", () => {
  it("redacts secret fields in before/after-shaped payloads", () => {
    const redacted = redactForAudit({
      username: "admin",
      password: "super-secret",
      pan: "ABCDE1234F",
      tokenHash: "abc123",
      nested: { accountNumber: "9999", label: "Primary" },
    }) as Record<string, unknown>;

    expect(redacted.username).toBe("admin");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.pan).toBe("[REDACTED]");
    expect(redacted.tokenHash).toBe("[REDACTED]");
    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.accountNumber).toBe("[REDACTED]");
    expect(nested.label).toBe("Primary");
  });
});
