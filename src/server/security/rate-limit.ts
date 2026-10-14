/**
 * Login rate limiting (B2-03) backed by Postgres `login_attempts`.
 * Decision logic is pure and injectable for unit tests; DB helpers count rows
 * inside the lockout window.
 *
 * Results are intentionally generic — callers must not reveal username vs IP.
 */
import { and, gte, sql } from "drizzle-orm";
import {
  LOGIN_LOCKOUT_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS_PER_IP,
  LOGIN_MAX_ATTEMPTS_PER_USERNAME,
} from "./constants.js";
import { loginAttempts } from "../db/schema.js";
import type { AppDb, AppTx } from "../db/client.js";

export {
  LOGIN_LOCKOUT_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS_PER_IP,
  LOGIN_MAX_ATTEMPTS_PER_USERNAME,
} from "./constants.js";

export type LoginRateLimitDecision = {
  /** When false, refuse the login with a generic error. */
  allowed: boolean;
};

export type LoginAttemptCounts = {
  usernameAttempts: number;
  ipAttempts: number;
};

/**
 * Pure decision: blocked when either counter is at/over its limit.
 * Generic — does not say which limit fired.
 */
export function decideLoginRateLimit(
  counts: LoginAttemptCounts,
  limits: {
    maxPerUsername?: number;
    maxPerIp?: number;
  } = {},
): LoginRateLimitDecision {
  const maxUser = limits.maxPerUsername ?? LOGIN_MAX_ATTEMPTS_PER_USERNAME;
  const maxIp = limits.maxPerIp ?? LOGIN_MAX_ATTEMPTS_PER_IP;
  if (counts.usernameAttempts >= maxUser || counts.ipAttempts >= maxIp) {
    return { allowed: false };
  }
  return { allowed: true };
}

type DbOrTx = AppDb | AppTx;

async function countAttempts(
  db: DbOrTx,
  opts: { username?: string; ip?: string; since: Date },
): Promise<number> {
  const conditions = [gte(loginAttempts.attemptedAt, opts.since)];
  if (opts.username !== undefined) {
    conditions.push(sql`${loginAttempts.username} = ${opts.username}`);
  }
  if (opts.ip !== undefined) {
    conditions.push(sql`${loginAttempts.ip} = ${opts.ip}`);
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(...conditions));
  return row?.count ?? 0;
}

/** Count attempts in the window and return a generic allow/deny. */
export async function checkLoginRateLimit(
  db: DbOrTx,
  username: string,
  ip: string,
  now: Date = new Date(),
): Promise<LoginRateLimitDecision> {
  const since = new Date(now.getTime() - LOGIN_LOCKOUT_WINDOW_MS);
  const [usernameAttempts, ipAttempts] = await Promise.all([
    countAttempts(db, { username, since }),
    countAttempts(db, { ip, since }),
  ]);
  return decideLoginRateLimit({ usernameAttempts, ipAttempts });
}

/** Record a failed login attempt (call after a failed verify). */
export async function recordLoginAttempt(
  db: DbOrTx,
  username: string,
  ip: string,
  attemptedAt: Date = new Date(),
): Promise<void> {
  await db.insert(loginAttempts).values({ username, ip, attemptedAt });
}
