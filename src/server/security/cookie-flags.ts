/**
 * Documented session cookie expectations for B9-02 automated checks.
 */
import { SESSION_ABSOLUTE_TTL_MS, SESSION_COOKIE_NAME, sessionCookieFlags } from "./session.js";

export const EXPECTED_SESSION_COOKIE_FLAGS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/" as const,
  maxAgeSeconds: Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000),
  /** Secure is required in production; optional in local http. */
  secureInProduction: true as const,
};

export function assertSessionCookieFlags(): typeof EXPECTED_SESSION_COOKIE_FLAGS {
  const prod = sessionCookieFlags({ secure: true });
  const dev = sessionCookieFlags({ secure: false });

  if (!prod.httpOnly || !dev.httpOnly) {
    throw new Error("Session cookie must be HttpOnly");
  }
  if (prod.sameSite !== "lax" || dev.sameSite !== "lax") {
    throw new Error('Session cookie SameSite must be "lax"');
  }
  if (prod.path !== "/" || dev.path !== "/") {
    throw new Error('Session cookie path must be "/"');
  }
  if (prod.maxAge !== EXPECTED_SESSION_COOKIE_FLAGS.maxAgeSeconds) {
    throw new Error(
      `Session cookie maxAge expected ${EXPECTED_SESSION_COOKIE_FLAGS.maxAgeSeconds}, got ${prod.maxAge}`,
    );
  }
  if (prod.secure !== true) {
    throw new Error("Session cookie Secure must be true when secure:true");
  }
  if (dev.secure !== false) {
    throw new Error("Session cookie Secure must be false when secure:false");
  }
  return EXPECTED_SESSION_COOKIE_FLAGS;
}
