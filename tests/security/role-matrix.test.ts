import { describe, expect, it } from "vitest";
import {
  ACTORS,
  ROLE_MATRIX,
  ROLE_MATRIX_EXPECTED_IDS,
  isDenial,
  type Expectation,
} from "./role-matrix.js";

describe("role matrix (B2-12 / B3-14)", () => {
  it("covers every expected operation id", () => {
    const ids = ROLE_MATRIX.map((r) => r.id);
    expect(ids.sort()).toEqual([...ROLE_MATRIX_EXPECTED_IDS].sort());
    expect(ROLE_MATRIX.length).toBe(ROLE_MATRIX_EXPECTED_IDS.length);
  });

  for (const row of ROLE_MATRIX) {
    describe(row.id, () => {
      for (const actor of ACTORS) {
        const expected: Expectation = row.expectations[actor];
        it(`${actor} → ${expected}`, async () => {
          let denied = false;
          try {
            await row.run(actor);
          } catch (err) {
            if (isDenial(err)) {
              denied = true;
            } else {
              throw err;
            }
          }

          if (expected === "allow") {
            expect(denied, `unexpected deny for ${row.id} as ${actor}`).toBe(false);
          } else {
            expect(denied, `unexpected allow for ${row.id} as ${actor}`).toBe(true);
          }
        });
      }
    });
  }
});
