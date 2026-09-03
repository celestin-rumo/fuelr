import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/**
 * The account the backend creates at boot, from ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * The defaults are the development compose file's. CI starts its backend with
 * a different address and passes it in — which is the bug this comment now
 * stands in front of: a default that was right in one environment only turned
 * an admin-only page into a red pipeline.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@celestinrumo.ch";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "changeme";

async function signInAs(
  request: APIRequestContext,
  context: BrowserContext,
  email: string,
  password: string,
) {
  const response = await request.post(`${BACKEND}/api/auth/login`, {
    data: { email, password },
  });
  expect(response.status(), "the admin account should exist at boot").toBe(200);
  await context.addCookies([
    {
      name: "fuelr_token",
      value: (await response.json()).token,
      url: "http://localhost:3000",
    },
  ]);
}

async function signInAsSomebodyElse(
  request: APIRequestContext,
  context: BrowserContext,
) {
  const email = `costs-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  await context.addCookies([
    {
      name: "fuelr_token",
      value: (await response.json()).token,
      url: "http://localhost:3000",
    },
  ]);
}

test("an operator sees what the assisted reads cost", async ({
  request,
  context,
  page,
}) => {
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/fr/total-costs");

  await expect(
    page.getByRole("heading", { name: "Assisted reads, and what they cost" }),
  ).toBeVisible();
  // The month and the whole of it answer different questions, so both are on
  // screen rather than behind a parameter.
  await expect(page.getByText("This month", { exact: true })).toBeVisible();
  await expect(page.getByText("Since the start", { exact: true })).toBeVisible();
  await expect(page.getByText("By account, this month")).toBeVisible();
});

test("anybody else gets a page that does not exist", async ({
  request,
  context,
  page,
}) => {
  await signInAsSomebodyElse(request, context);
  const response = await page.goto("/fr/total-costs");

  // 404, not 403: a screen that exists only for operators has no reason to
  // confirm to everybody else that it exists.
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Assisted reads, and what they cost" }),
  ).toHaveCount(0);
});

test("and neither does somebody with no session at all", async ({ page }) => {
  const response = await page.goto("/fr/total-costs");
  expect(response?.status()).toBe(404);
});

test("the table scrolls in its own box rather than moving the page", async ({
  request,
  context,
  page,
}) => {
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/fr/total-costs");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Seven columns of figures do not fold. They scroll inside their container,
  // and the page body still does not move sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
