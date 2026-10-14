import { afterEach, describe, expect, it, vi } from "vitest";
import { log, redactSecrets } from "../../../src/server/kernel/logger.js";

describe("kernel logger (B0-09)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts a password field so output does not contain the raw password", () => {
    const rawPassword = "super-secret-dev-password-xyz";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    log.info("login attempt", { username: "admin", password: rawPassword });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = String(infoSpy.mock.calls[0]?.[0]);
    expect(line).not.toContain(rawPassword);
    expect(line).toContain("[REDACTED]");
    expect(line).toContain("admin");
  });

  it("redacts nested sensitive keys case-insensitively", () => {
    const redacted = redactSecrets({
      Authorization: "Bearer abc",
      nested: { PAN: "ABCDE1234F", accountNumber: "123456" },
    }) as Record<string, unknown>;

    expect(redacted.Authorization).toBe("[REDACTED]");
    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.PAN).toBe("[REDACTED]");
    expect(nested.accountNumber).toBe("[REDACTED]");
  });
});
