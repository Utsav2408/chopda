import { describe, expect, it } from "vitest";
import { requireCronSecret } from "../../../src/server/security/cron.js";
import { Unauthenticated } from "../../../src/server/kernel/errors.js";

const SECRET = "test-cron-secret-value";

function req(headers: Record<string, string>): Request {
  return new Request("https://app.example/api/cron/purge", { headers });
}

describe("cron guard (B2-11)", () => {
  it("accepts matching Bearer secret", () => {
    expect(() =>
      requireCronSecret(req({ authorization: `Bearer ${SECRET}` }), { secret: SECRET }),
    ).not.toThrow();
  });

  it("accepts matching x-cron-secret header", () => {
    expect(() =>
      requireCronSecret(req({ "x-cron-secret": SECRET }), { secret: SECRET }),
    ).not.toThrow();
  });

  it("missing secret returns Unauthenticated (401)", () => {
    expect(() => requireCronSecret(req({}), { secret: SECRET })).toThrow(Unauthenticated);
  });

  it("wrong secret returns Unauthenticated (401)", () => {
    expect(() =>
      requireCronSecret(req({ authorization: "Bearer wrong-secret" }), { secret: SECRET }),
    ).toThrow(Unauthenticated);
  });
});
