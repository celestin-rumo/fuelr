import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `nut-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  const { token } = await response.json();
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function addIngredient(page: import("@playwright/test").Page, name: string, qty: string, unit?: string) {
  await page.getByLabel("Ingrédient").fill(name);
  await page.getByLabel("Quantité").fill(qty);
  if (unit) await page.getByLabel("Unité").selectOption(unit);
  await page.getByLabel("Quantité").press("Enter");
}

test.beforeEach(async ({ request, context, page }) => {
  await signIn(request, context);
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: /Ingrédients/ }).click();
});

test("figures appear on the first ingredient, with no button to press", async ({ page }) => {
  await expect(page.getByTestId("nutrition-panel")).toHaveCount(0);

  await addIngredient(page, "Lentilles corail", "300");

  // The figures themselves belong to a published table this suite does not
  // own, so what is asserted is that they arrived, unprompted, and are real.
  const panel = page.getByTestId("nutrition-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/[1-9]\d{1,4}(\.\d)?/);
  await expect(page.getByTestId("nutrition-estimated")).toHaveCount(0);
});

test("the figures follow every further ingredient", async ({ page }) => {
  await addIngredient(page, "Riz", "400");
  const panel = page.getByTestId("nutrition-panel");
  const first = await energy(panel);

  await addIngredient(page, "Huile", "10");

  // Oil is not free: adding it has to move the number up.
  await expect
    .poll(async () => energy(panel))
    .toBeGreaterThan(first);
});

/** The kcal figure the panel is showing, whatever the table says it is. */
async function energy(panel: import("@playwright/test").Locator) {
  const text = (await panel.textContent()) ?? "";
  const match = /kcal[^0-9]*([0-9]+(?:\.[0-9])?)/.exec(text)
      ?? /([0-9]+(?:\.[0-9])?)/.exec(text);
  return match ? Number(match[1]) : 0;
}

test("changing the servings rescales the figures", async ({ page }) => {
  await addIngredient(page, "Riz", "400");
  const panel = page.getByTestId("nutrition-panel");
  const forFour = await energy(panel);

  await page.getByRole("button", { name: /Base/ }).click();
  await page.getByRole("button", { name: "Une portion de moins" }).click();
  await page.getByRole("button", { name: "Une portion de moins" }).click();
  await page.getByRole("button", { name: /Ingrédients/ }).click();

  // The same rice over two servings instead of four: twice per plate.
  await expect
    .poll(async () => energy(panel))
    .toBeCloseTo(forFour * 2, 0);
});

test("an unrecognised ingredient is marked as estimated", async ({ page }) => {
  // A brand no composition table publishes. The fallback is for exactly this,
  // and it says so rather than passing a guess off as a measurement.
  await addIngredient(page, "Zoubidou 3000", "100");

  await expect(page.getByTestId("nutrition-estimated")).toBeVisible();
  await expect(page.getByTestId("nutrition-panel")).toContainText("Zoubidou 3000");
});

test("a recognised ingredient carries no estimate marker", async ({ page }) => {
  await addIngredient(page, "Saumon", "200");

  await expect(page.getByTestId("nutrition-panel")).toBeVisible();
  await expect(page.getByTestId("nutrition-estimated")).toHaveCount(0);
});

test("the figures are set in tabular numerals", async ({ page }) => {
  await addIngredient(page, "Riz", "400");

  const value = page.getByTestId("nutrition-panel").locator("dd").first();
  await expect(value).toHaveClass(/tnum/);
  // The class has to actually resolve, not just be present in the markup.
  await expect(value).toHaveCSS("font-variant-numeric", "tabular-nums");
});
