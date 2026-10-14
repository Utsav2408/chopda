import { describe, expect, it } from "vitest";
import {
  CONTENT_SECURITY_POLICY,
  EXPECTED_SECURITY_HEADERS,
  securityHeadersForNextConfig,
} from "../../../src/server/security/headers.js";

describe("security headers map (B2-09)", () => {
  it("includes CSP, HSTS, frame, referrer, nosniff", () => {
    expect(EXPECTED_SECURITY_HEADERS["Content-Security-Policy"]).toBe(CONTENT_SECURITY_POLICY);
    expect(EXPECTED_SECURITY_HEADERS["Strict-Transport-Security"]).toContain("max-age=");
    expect(EXPECTED_SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(EXPECTED_SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(EXPECTED_SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("securityHeadersForNextConfig mirrors the expected map", () => {
    const list = securityHeadersForNextConfig();
    expect(list.length).toBe(Object.keys(EXPECTED_SECURITY_HEADERS).length);
    for (const { key, value } of list) {
      expect(EXPECTED_SECURITY_HEADERS[key]).toBe(value);
    }
  });
});
