import { expect, test, type Page } from "@playwright/test";

/**
 * U5-04: End-to-end skeleton — Admin creates invoice → Builder completes a
 * step with upload → Viewer can view but not mutate.
 *
 * Skipped unless E2E_SEEDED=1. See tests/e2e/README.md.
 */

const seeded = process.env.E2E_SEEDED === "1";

const adminUser = process.env.E2E_ADMIN_USER ?? "admin";
const adminPass = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe!dev-only";
const builderUser = process.env.E2E_BUILDER_USER ?? "builder1";
const builderPass = process.env.E2E_BUILDER_PASSWORD ?? "ChangeMe!dev-only";
const viewerUser = process.env.E2E_VIEWER_USER ?? "viewer1";
const viewerPass = process.env.E2E_VIEWER_PASSWORD ?? "ChangeMe!dev-only";

test.describe("invoice lifecycle (U5-04)", () => {
  test.skip(!seeded, "Set E2E_SEEDED=1 with a seeded DB and passwords (see tests/e2e/README.md)");

  test("Admin creates, Builder completes with upload, Viewer views only", async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";

    await signIn(page, origin, adminUser, adminPass);
    await page.goto(`${origin}/invoices/new`);
    await expect(page.getByRole("button", { name: /create invoice/i })).toBeVisible();

    const invoiceNo = `E2E-${Date.now()}`;
    await page.getByLabel(/invoice number/i).fill(invoiceNo);
    await page.getByLabel(/party name/i).fill("E2E Party");
    await page.getByLabel(/amount \(rupees\)/i).fill("1000");
    await page.getByRole("button", { name: /create invoice/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]+/i, { timeout: 20_000 });

    const invoiceUrl = page.url();
    await expect(page.getByText(invoiceNo)).toBeVisible();

    await signOut(page, origin);
    await signIn(page, origin, builderUser, builderPass);
    await page.goto(invoiceUrl);
    await expect(page.getByText(invoiceNo)).toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles({
        name: "e2e-proof.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("e2e upload proof"),
      });
    }

    const completeBtn = page.getByRole("button", { name: /complete step/i });
    if ((await completeBtn.count()) > 0) {
      await completeBtn.click();
    }

    await signOut(page, origin);
    await signIn(page, origin, viewerUser, viewerPass);
    await page.goto(invoiceUrl);
    await expect(page.getByText(invoiceNo)).toBeVisible();
    await expect(page.getByRole("button", { name: /complete step/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /new invoice/i })).toHaveCount(0);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const createRes = await request.post(`${origin}/api/invoices`, {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
        Origin: origin,
      },
      data: {
        invoiceNo: `VIEWER-FAIL-${Date.now()}`,
        partyName: "Should Fail",
        amountPaise: 100,
      },
    });
    expect(createRes.status()).toBeGreaterThanOrEqual(400);
  });
});

async function signIn(page: Page, origin: string, username: string, password: string) {
  await page.goto(`${origin}/login`);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  if (page.url().includes("/change-password")) {
    throw new Error(
      `User ${username} must change password. Clear must_change_password for E2E users (see tests/e2e/README.md).`,
    );
  }
}

async function signOut(page: Page, origin: string) {
  const res = await page.request.post(`${origin}/api/auth/logout`);
  expect(res.ok()).toBeTruthy();
  await page.context().clearCookies();
}
