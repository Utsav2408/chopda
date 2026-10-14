import { describe, expect, it } from "vitest";
import {
  Conflict,
  Forbidden,
  Internal,
  NotFound,
  RateLimited,
  Unauthenticated,
  Validation,
} from "../../../src/server/kernel/errors.js";

describe("kernel errors (B0-09)", () => {
  it("constructs each typed error with a matching code", () => {
    expect(new Unauthenticated().code).toBe("Unauthenticated");
    expect(new Forbidden().code).toBe("Forbidden");
    expect(new NotFound().code).toBe("NotFound");
    expect(new Validation().code).toBe("Validation");
    expect(new Conflict().code).toBe("Conflict");
    expect(new RateLimited().code).toBe("RateLimited");
    expect(new Internal().code).toBe("Internal");
  });

  it("makes NotFound and Forbidden look the same by default", () => {
    expect(new NotFound().message).toBe(new Forbidden().message);
    expect(new NotFound().message).toBe("Not found");
  });

  it("accepts custom messages", () => {
    expect(new Validation("bad field").message).toBe("bad field");
    expect(new Conflict("duplicate").message).toBe("duplicate");
  });
});
