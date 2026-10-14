/**
 * Edge-safe session cookie name (no Node-only imports).
 * Middleware and the session module must stay in sync on this value.
 */
export const SESSION_COOKIE_NAME = "chopda_session";

/** Absolute session lifetime from creation (B2-02). */
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Idle timeout: session dies if last_seen_at is older than this (B2-02). */
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Minimum password length enforced by the password module (B2-01). */
export const PASSWORD_MIN_LENGTH = 10;

/** Max JSON/body size for server actions and handlers (B2-09). */
export const MAX_INPUT_BYTES = 1_048_576; // 1 MiB

/** Login lockout window for counting attempts (B2-03). */
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Failed attempts per username inside the lockout window before block. */
export const LOGIN_MAX_ATTEMPTS_PER_USERNAME = 5;

/** Failed attempts per IP inside the lockout window before block. */
export const LOGIN_MAX_ATTEMPTS_PER_IP = 25;
