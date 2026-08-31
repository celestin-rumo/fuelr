import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `kb-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  const { token } = await response.json();
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

test.beforeEach(async ({ request, context, page }) => {
  await signIn(request, context);
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: /Ingrédients/ }).click();
});

test("Enter commits the line and puts the caret back on the name", async ({ page }) => {
  await page.getByLabel("Ingrédient").fill("Lentilles corail");
  await page.getByLabel("Quantité").fill("300");
  await page.getByLabel("Quantité").press("Enter");

  await expect(page.getByText("Lentilles corail")).toBeVisible();

  // The whole point: the next ingredient can be typed without reaching for
  // the mouse, so the fields are cleared and the caret is back on the name.
  await expect(page.getByLabel("Ingrédient")).toBeFocused();
  await expect(page.getByLabel("Ingrédient")).toHaveValue("");
  await expect(page.getByLabel("Quantité")).toHaveValue("");
});

test("Enter works from the name field too", async ({ page }) => {
  await page.getByLabel("Quantité").fill("2");
  await page.getByLabel("Ingrédient").fill("Oignon");
  await page.getByLabel("Ingrédient").press("Enter");

  await expect(page.getByText("Oignon")).toBeVisible();
  await expect(page.getByLabel("Ingrédient")).toBeFocused();
});

test("Enter works from the unit selector", async ({ page }) => {
  await page.getByLabel("Ingrédient").fill("Lait de coco");
  await page.getByLabel("Quantité").fill("400");
  await page.getByLabel("Unité").selectOption("ml");
  await page.getByLabel("Unité").press("Enter");

  await expect(page.getByText("400 ml")).toBeVisible();
  await expect(page.getByLabel("Ingrédient")).toBeFocused();
});

test("ten ingredients can be entered without touching the mouse", async ({ page }) => {
  const items = [
    "Lentilles", "Coco", "Oignon", "Ail", "Gingembre",
    "Curry", "Épinards", "Tomate", "Riz", "Huile",
  ];

  await page.getByLabel("Ingrédient").focus();
  for (const [index, item] of items.entries()) {
    await page.keyboard.type(item);
    await page.keyboard.press("Tab");
    await page.keyboard.type(String((index + 1) * 10));
    await page.keyboard.press("Enter");
  }

  for (const item of items) {
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }
});

test("the five units are offered and each is kept", async ({ page }) => {
  const units = ["g", "ml", "pcs", "c.à.s", "c.à.c"];

  const options = await page.getByLabel("Unité").locator("option").allTextContents();
  expect(options).toEqual(units);

  for (const [index, unit] of units.entries()) {
    await page.getByLabel("Ingrédient").fill(`Aliment ${index}`);
    await page.getByLabel("Quantité").fill(String(index + 1));
    await page.getByLabel("Unité").selectOption(unit);
    await page.getByLabel("Quantité").press("Enter");
    await expect(page.getByText(`${index + 1} ${unit}`)).toBeVisible();
  }
});

test("an incomplete line is not committed", async ({ page }) => {
  // A name with no quantity must not create a line, and must not clear what
  // was typed — losing the name would be worse than doing nothing.
  await page.getByLabel("Ingrédient").fill("Sel");
  await page.getByLabel("Ingrédient").press("Enter");

  await expect(page.getByText("Aucun ingrédient pour l'instant.")).toBeVisible();
  await expect(page.getByLabel("Ingrédient")).toHaveValue("Sel");
});

test("every line can be removed", async ({ page }) => {
  for (const item of ["Oignon", "Ail", "Curry"]) {
    await page.getByLabel("Ingrédient").fill(item);
    await page.getByLabel("Quantité").fill("1");
    await page.getByLabel("Quantité").press("Enter");
  }

  await page.getByRole("button", { name: "Retirer Ail" }).click();
  await expect(page.getByText("Ail", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Oignon", { exact: true })).toBeVisible();
  await expect(page.getByText("Curry", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Retirer Oignon" }).click();
  await page.getByRole("button", { name: "Retirer Curry" }).click();
  await expect(page.getByText("Aucun ingrédient pour l'instant.")).toBeVisible();
});
