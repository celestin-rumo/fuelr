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

  // 350 kcal/100 g × 3 = 1050, one serving default is 4 → 262.5
  const panel = page.getByTestId("nutrition-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("262.5");
});

test("the figures follow every further ingredient", async ({ page }) => {
  await addIngredient(page, "Riz", "400");
  await expect(page.getByTestId("nutrition-panel")).toContainText("350");

  await addIngredient(page, "Huile", "10");
  // 1400 + 88 = 1488 over 4 servings = 372
  await expect(page.getByTestId("nutrition-panel")).toContainText("372");
});

test("changing the servings rescales the figures", async ({ page }) => {
  await addIngredient(page, "Riz", "400");
  await expect(page.getByTestId("nutrition-panel")).toContainText("350");

  await page.getByRole("button", { name: /Base/ }).click();
  await page.getByRole("button", { name: "Une portion de moins" }).click();
  await page.getByRole("button", { name: "Une portion de moins" }).click();

  await page.getByRole("button", { name: /Ingrédients/ }).click();
  // 1400 over 2 servings = 700
  await expect(page.getByTestId("nutrition-panel")).toContainText("700");
});

test("an unrecognised ingredient is marked as estimated", async ({ page }) => {
  await addIngredient(page, "Racine de yuzu confite", "100");

  await expect(page.getByTestId("nutrition-estimated")).toBeVisible();
  await expect(page.getByTestId("nutrition-panel")).toContainText(
    "Racine de yuzu confite",
  );
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
