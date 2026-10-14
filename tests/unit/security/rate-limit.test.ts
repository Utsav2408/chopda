import { describe, expect, it } from "vitest";
import {
  decideLoginRateLimit,
  LOGIN_MAX_ATTEMPTS_PER_IP,
  LOGIN_MAX_ATTEMPTS_PER_USERNAME,
} from "../../../src/server/security/rate-limit.js";

describe("login rate limit decision (B2-03)", () => {
  it("allows when both counters are under the limit", () => {
    expect(
      decideLoginRateLimit({
        usernameAttempts: LOGIN_MAX_ATTEMPTS_PER_USERNAME - 1,
        ipAttempts: LOGIN_MAX_ATTEMPTS_PER_IP - 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks when username attempts hit the limit (generic result)", () => {
    expect(
      decideLoginRateLimit({
        usernameAttempts: LOGIN_MAX_ATTEMPTS_PER_USERNAME,
        ipAttempts: 0,
      }),
    ).toEqual({ allowed: false });
  });

  it("blocks when IP attempts hit the limit (generic result)", () => {
    expect(
      decideLoginRateLimit({
        usernameAttempts: 0,
        ipAttempts: LOGIN_MAX_ATTEMPTS_PER_IP,
      }),
    ).toEqual({ allowed: false });
  });

  it("Nth failure is blocked then allowed after window (injected counts)", () => {
    const maxUser = 3;
    // After 2 failures still allowed; 3rd check (counts=3) blocked.
    expect(
      decideLoginRateLimit({ usernameAttempts: 2, ipAttempts: 0 }, { maxPerUsername: maxUser }),
    ).toEqual({ allowed: true });
    expect(
      decideLoginRateLimit({ usernameAttempts: 3, ipAttempts: 0 }, { maxPerUsername: maxUser }),
    ).toEqual({ allowed: false });
    // After the window, counters reset to 0 → allowed again.
    expect(
      decideLoginRateLimit({ usernameAttempts: 0, ipAttempts: 0 }, { maxPerUsername: maxUser }),
    ).toEqual({ allowed: true });
  });
});
