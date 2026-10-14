import { describe, expect, it } from "vitest";
import {
  assertInputSize,
  assertSameOrigin,
  MAX_INPUT_BYTES,
} from "../../../src/server/security/csrf.js";
import { Forbidden, Validation } from "../../../src/server/kernel/errors.js";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("csrf / origin helper (B2-09)", () => {
  it("accepts matching Origin", () => {
    expect(() =>
      assertSameOrigin(req("https://app.example/login", { origin: "https://app.example" })),
    ).not.toThrow();
  });

  it("rejects mismatched Origin", () => {
    expect(() =>
      assertSameOrigin(req("https://app.example/login", { origin: "https://evil.example" })),
    ).toThrow(Forbidden);
  });

  it("accepts matching Referer when Origin absent", () => {
    expect(() =>
      assertSameOrigin(
        req("https://app.example/login", { referer: "https://app.example/dashboard" }),
      ),
    ).not.toThrow();
  });

  it("requires Origin or Referer by default", () => {
    expect(() => assertSameOrigin(req("https://app.example/login"))).toThrow(Validation);
  });

  it("assertInputSize enforces MAX_INPUT_BYTES", () => {
    expect(MAX_INPUT_BYTES).toBe(1_048_576);
    expect(() => assertInputSize(MAX_INPUT_BYTES)).not.toThrow();
    expect(() => assertInputSize(MAX_INPUT_BYTES + 1)).toThrow(Validation);
  });
});
