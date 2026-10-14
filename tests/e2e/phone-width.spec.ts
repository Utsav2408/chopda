import { expect, test } from "@playwright/test";

/**
 * U5-03: Phone-width smoke at 390px — no horizontal document overflow
 * on key routes. Auth-gated routes may land on /login without a seed;
 * we still assert the final page does not overflow.
 */
const PHONE = { width: 390, height: 844 };

const ROUTES = ["/login", "/dashboard", "/invoices", "/flows"] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    `document scrollWidth (${scrollWidth}) should not exceed innerWidth (${innerWidth})`,
  ).toBeLessThanOrEqual(innerWidth);
}

test.describe("phone-width smoke (U5-03)", () => {
  test.use({ viewport: PHONE });

  for (const path of ROUTES) {
    test(`${path} has no horizontal overflow at 390px`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await assertNoHorizontalOverflow(page);
    });
  }
});
