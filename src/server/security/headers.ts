/**
 * Expected security headers (B2-09). Source of truth is headers.shared.mjs
 * (also imported by next.config.ts).
 */
export {
  CONTENT_SECURITY_POLICY,
  EXPECTED_SECURITY_HEADERS,
  securityHeadersForNextConfig,
} from "./headers.shared.mjs";
