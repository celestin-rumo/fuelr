import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";
const WEDNESDAY = "2026-03-04";
const THURSDAY = "2026-03-05";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `courses-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function recipe(
  request: APIRequestContext,
  title: string,
  ingredients: { name: string; quantity: number; unit: string }[],
) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, servings: 4, ingredients, steps: ["Cuire 20 min."] },
  });
  return id as number;
}

/** Planned for four, so the quantities on the list are the recipe's own. */
async function planMeal(
  request: APIRequestContext,
  date: string,
  slot: string,
  recipeId: number,
) {
  const response = await request.post(`${BACKEND}/api/plan`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { date, slot, recipeId, servings: 4 },
  });
  return (await response.json()).id as number;
}

async function openList(page: Page, week = MONDAY) {
  await page.goto(`/fr/app/courses?week=${week}`);
  await expect(page.getByTestId("shopping-week")).toBeVisible();
}

/**
 * Ticks a line the way a thumb does: on the row.
 *
 * The input itself is `sr-only` and the drawn box sits over it, so clicking
 * the input directly is intercepted — which is only ever a problem for a
 * robot. A person hits the label, and the label is the 56px row.
 */
async function tickRow(row: Locator) {
  await row.locator("label").first().click();
}

/** The worker only takes over once it has installed and claimed the page. */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  });
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

// --- generating -------------------------------------------------------------

test("the week becomes a list, summed and grouped by aisle", async ({ request, page }) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles", quantity: 200, unit: "g" },
    { name: "Tomate", quantity: 300, unit: "g" },
  ]);
  await planMeal(request, WEDNESDAY, "DINNER", curry);
  await planMeal(request, THURSDAY, "DINNER", curry);

  await openList(page);

  // Two dinners of 200 g are one line of 400 g, not two lines.
  const groceries = page.getByRole("heading", { name: "Épicerie" });
  await expect(groceries).toBeVisible();
  await expect(page.getByTestId("aisles")).toContainText("400 g");
  // Produce comes before groceries: the order a shop is walked.
  const headings = await page.getByTestId("aisles").getByRole("heading").allTextContents();
  expect(headings).toEqual(["Fruits & légumes", "Épicerie"]);
});

test("an empty week says so instead of showing an empty box", async ({ page }) => {
  await openList(page);
  await expect(page.getByTestId("shopping-empty")).toBeVisible();
});

// --- ticking, one-handed ----------------------------------------------------

test("a line is ticked with a thumb, stays visible, and survives a reload", async ({
  request,
  page,
}) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles", quantity: 200, unit: "g" },
  ]);
  await planMeal(request, WEDNESDAY, "DINNER", curry);
  await openList(page);

  const row = page.getByTestId("aisles").getByRole("listitem").first();
  const box = row.getByRole("checkbox");

  // 56px of target, for a hand holding a basket.
  const target = await row.locator("label").boundingBox();
  expect(target?.height ?? 0).toBeGreaterThanOrEqual(56);

  await tickRow(row);
  await expect(box).toBeChecked();
  // Still there, struck through: it is the record of the trip.
  await expect(row).toContainText("Lentilles");

  await page.reload();
  await expect(page.getByTestId("aisles").getByRole("checkbox").first()).toBeChecked();
});

test("regenerating from a changed plan keeps the boxes already ticked", async ({
  request,
  page,
}) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles", quantity: 200, unit: "g" },
  ]);
  await planMeal(request, WEDNESDAY, "DINNER", curry);
  await openList(page);
  await tickRow(page.getByTestId("aisles").getByRole("listitem").first());
  await expect(page.getByTestId("aisles").getByRole("checkbox").first()).toBeChecked();

  // The plan changes under the list.
  await planMeal(request, THURSDAY, "DINNER", curry);
  await openList(page);

  await expect(page.getByTestId("aisles").getByRole("checkbox").first()).toBeChecked();
  await expect(page.getByTestId("aisles")).toContainText("400 g");
});

// --- free items -------------------------------------------------------------

test("something with no recipe behind it joins the same list, and stays", async ({
  request,
  page,
}) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles", quantity: 200, unit: "g" },
  ]);
  await planMeal(request, WEDNESDAY, "DINNER", curry);
  await openList(page);

  await page.getByLabel("Article", { exact: true }).fill("Papier toilette");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByTestId("aisles")).toContainText("Papier toilette");

  // A regeneration does not sweep it away.
  await planMeal(request, THURSDAY, "DINNER", curry);
  await openList(page);
  await expect(page.getByTestId("aisles")).toContainText("Papier toilette");

  await page.getByRole("button", { name: "Retirer Papier toilette de la liste" }).click();
  await expect(page.getByTestId("aisles")).not.toContainText("Papier toilette");
});

// --- the cupboard -----------------------------------------------------------

test("what is already at home is deducted, and cooking takes it off the shelf", async ({
  request,
  page,
}) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles", quantity: 200, unit: "g" },
  ]);
  const meal = await planMeal(request, WEDNESDAY, "DINNER", curry);
  await openList(page);

  await page.getByLabel("Ingrédient").fill("Lentilles");
  await page.getByLabel("Quantité (g)").fill("500");
  await page.getByRole("button", { name: "Mettre au placard" }).click();

  // 500 g at home covers the 200 g the week needs, so nothing to buy — and it
  // is shown rather than hidden.
  await expect(page.getByTestId("covered")).toContainText("Lentilles");
  await expect(page.getByTestId("remaining")).toContainText("Tout est pris");

  // Cooking Wednesday's dinner takes 200 g off the shelf.
  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await page.getByRole("button", { name: /Modifier Curry — mercredi, Dîner/ }).click();
  await page.locator('label:has([data-testid="meal-cooked"])').click();
  await page.getByRole("button", { name: "Fermer" }).click();

  await openList(page);
  await expect(page.getByTestId("pantry")).toContainText("300");
  // Still covered: 300 g is more than the 200 g the week asks for.
  await expect(page.getByTestId("covered")).toContainText("Lentilles");

  void meal;
});

// --- a supermarket basement -------------------------------------------------

test("the list works with no network, and the ticks arrive when it comes back", async ({
  request,
  context,
  page,
}) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles", quantity: 200, unit: "g" },
    { name: "Tomate", quantity: 300, unit: "g" },
  ]);
  await planMeal(request, WEDNESDAY, "DINNER", curry);

  await openList(page);
  await waitForServiceWorker(page);

  // Down the escalator.
  await context.setOffline(true);
  await page.reload();

  // The offline shell comes from the worker, and the list comes from the copy
  // on the device. Neither needs the network that is gone.
  await expect(page.getByTestId("aisles")).toContainText("Lentilles");
  const box = page.getByTestId("aisles").getByRole("checkbox").first();
  await tickRow(page.getByTestId("aisles").getByRole("listitem").first());
  await expect(box).toBeChecked();
  await expect(page.getByTestId("pending-ticks")).toBeVisible();

  // Back at street level.
  await context.setOffline(false);
  await openList(page);

  // The tick made underground is on the server, without anybody doing anything.
  await expect(page.getByTestId("aisles").getByRole("checkbox").first()).toBeChecked();
  await expect(page.getByTestId("pending-ticks")).toHaveCount(0);
});

// --- the shape of the screen ------------------------------------------------

test("the list holds up on a phone", async ({ request, page }) => {
  const curry = await recipe(request, "Curry", [
    { name: "Lentilles corail", quantity: 200, unit: "g" },
    { name: "Lait de coco", quantity: 400, unit: "ml" },
  ]);
  await planMeal(request, WEDNESDAY, "DINNER", curry);

  await page.setViewportSize({ width: 375, height: 812 });
  await openList(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the list is reachable from the header", async ({ page }) => {
  await page.goto("/fr/app");

  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Courses" })
    .click();

  await expect(page).toHaveURL(/\/fr\/app\/courses/);
  await expect(page.getByRole("heading", { name: "Mes courses" })).toBeVisible();
});
