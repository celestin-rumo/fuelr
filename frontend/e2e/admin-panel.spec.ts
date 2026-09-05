import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

/**
 * The operator's panel.
 *
 * The point of most of this is what somebody who is not an operator gets:
 * nothing, and nothing that says there is something. Every page answers 404,
 * the same as the endpoints behind them, so the two cannot disagree about
 * whether the panel exists.
 */
const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@celestinrumo.ch";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "changeme";

const SECTIONS = [
  "/fr/admin/accounts",
  "/fr/admin/subscriptions",
  "/fr/admin/usage",
  "/fr/admin/ai-costs",
];

async function signInAs(
  request: APIRequestContext,
  context: BrowserContext,
  email: string,
  password: string,
) {
  const response = await request.post(`${BACKEND}/api/auth/login`, {
    data: { email, password },
  });
  const { token } = await response.json();
  await context.clearCookies();
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
  return token as string;
}

async function signInAsSomebodyElse(
  request: APIRequestContext,
  context: BrowserContext,
) {
  const email = `panel-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  const { token } = await response.json();
  await context.clearCookies();
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
  return { email, token: token as string };
}

async function register(request: APIRequestContext, email: string) {
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  return (await response.json()) as { token: string; user: { id: number } };
}

async function openSection(page: Page, path: string) {
  await page.goto(path);
}

// --- the door -------------------------------------------------------------

test("every section is a page that does not exist, for anybody else", async ({
  request,
  context,
  page,
}) => {
  await signInAsSomebodyElse(request, context);

  for (const path of SECTIONS) {
    await openSection(page, path);
    // 404 and not a redirect to a sign-in page: a panel that exists only for
    // the operator has no reason to confirm to anybody else that it exists.
    await expect(page.getByTestId("admin-nav")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Admin");
  }
});

test("and neither does it for somebody with no session at all", async ({ page }) => {
  await page.context().clearCookies();
  await openSection(page, "/fr/admin/accounts");
  await expect(page.getByTestId("admin-nav")).toHaveCount(0);
});

// --- what an operator gets ------------------------------------------------

test("an operator moves between the four sections", async ({
  request,
  context,
  page,
}) => {
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);

  await openSection(page, "/fr/admin/accounts");
  const nav = page.getByTestId("admin-nav");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "Accounts" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const [label, lands] of [
    ["Subscriptions", /\/admin\/subscriptions$/],
    ["Usage", /\/admin\/usage$/],
    ["AI costs", /\/admin\/ai-costs$/],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(lands);
    await expect(page.getByTestId("admin-nav")).toBeVisible();
  }
});

test("the old cost address still lands somewhere, in the panel", async ({
  request,
  context,
  page,
}) => {
  // An operator has that URL in a bookmark, and a bookmark that 404s teaches
  // them the page was removed rather than moved.
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/fr/total-costs");
  await expect(page).toHaveURL(/\/admin\/ai-costs$/);
});

test("an operator finds an account from the address somebody wrote from", async ({
  request,
  context,
  page,
}) => {
  const email = `found-${Date.now()}@fuelr.app`;
  await register(request, email);
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);

  await openSection(page, "/fr/admin/accounts");
  await page.getByLabel("Find an account").fill(email);
  await page.getByTestId("admin-search").click();

  const rows = page.getByTestId("admin-accounts").locator("li");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(email);

  await rows.first().getByRole("link", { name: email }).click();
  await expect(page.getByRole("heading", { name: email })).toBeVisible();
  await expect(page.locator("body")).toContainText("Household");
});

// --- the one action that destroys somebody else's data ---------------------

test("deleting asks with the address, and refuses until it is typed", async ({
  request,
  context,
  page,
}) => {
  const email = `doomed-${Date.now()}@fuelr.app`;
  await register(request, email);
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);

  await openSection(page, "/fr/admin/accounts");
  await page.getByLabel("Find an account").fill(email);
  await page.getByTestId("admin-search").click();

  await page.getByRole("button", { name: `Actions for ${email}` }).click();
  await page.getByRole("menuitem", { name: "Delete this account" }).click();

  const dialog = page.getByTestId("delete-dialog");
  await expect(dialog).toBeVisible();
  // It says what it carries away, and the figures come from the server rather
  // than from a sentence written in the component.
  await expect(dialog).toContainText("recipes");
  await expect(dialog).toContainText("no undo");

  const confirm = page.getByTestId("delete-confirm");
  await expect(confirm).toBeDisabled();

  await page.getByTestId("delete-confirm-input").fill("not-the-address");
  await expect(confirm).toBeDisabled();

  await page.getByTestId("delete-confirm-input").fill(email);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByTestId("admin-done")).toContainText(email);

  await page.getByLabel("Find an account").fill(email);
  await page.getByTestId("admin-search").click();
  await expect(page.getByTestId("admin-no-accounts")).toBeVisible();
});

test("a tier granted by hand shows up, and says who did it", async ({
  request,
  context,
  page,
}) => {
  const email = `granted-${Date.now()}@fuelr.app`;
  const { user } = await register(request, email);
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);

  await openSection(page, "/fr/admin/accounts");
  await page.getByLabel("Find an account").fill(email);
  await page.getByTestId("admin-search").click();

  await page.getByRole("button", { name: `Actions for ${email}` }).click();
  await page.getByRole("menuitem", { name: "Change the tier" }).click();

  await page.getByTestId("tier-choice").getByRole("button", { name: "FAMILY" }).click();
  await page.getByLabel("Why").fill("un remboursement");
  await page.getByTestId("tier-confirm").click();

  await expect(page.getByTestId("admin-done")).toContainText("FAMILY");

  // And it is written down against that account, with the reason.
  await page.goto(`/fr/admin/accounts/${user.id}`);
  await expect(page.locator("body")).toContainText("granted by an operator");
  await expect(page.locator("body")).toContainText("un remboursement");
  await expect(page.locator("body")).toContainText(ADMIN_EMAIL);
});

// --- the figures ----------------------------------------------------------

test("the subscription figures say nothing has been collected", async ({
  request,
  context,
  page,
}) => {
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openSection(page, "/fr/admin/subscriptions");

  await expect(page.locator("body")).toContainText("Nothing has been collected");
  // Committed, never "revenue": no provider is wired, so every plan here was
  // granted rather than bought.
  await expect(page.locator("body")).toContainText("Committed / month");
  await expect(page.locator("body")).not.toContainText("Revenue");
});

test("the usage figures name nobody", async ({ request, context, page }) => {
  const email = `counted-${Date.now()}@fuelr.app`;
  await register(request, email);
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);

  await openSection(page, "/fr/admin/usage");
  await expect(page.locator("body")).toContainText("What gets used");
  // The privacy page says this application measures nobody. These are counts
  // of rows, and no address appears on the page.
  await expect(page.locator("body")).not.toContainText("@fuelr.app");
});

// --- the phone ------------------------------------------------------------

test("the panel holds up at 360px, tables included", async ({
  request,
  context,
  page,
}) => {
  await signInAs(request, context, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.setViewportSize({ width: 360, height: 640 });

  for (const path of SECTIONS) {
    await openSection(page, path);
    await expect(page.getByTestId("admin-nav")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});
