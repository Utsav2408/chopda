import { expect, test } from "@playwright/test";

// Minimal e2e smoke test so the Playwright job (Wave D e2e.yml) has something
// real to run once it comes off soft-skip. Expand with P1-06 login flows etc.
test("health endpoint responds ok", async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}/health`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
});
