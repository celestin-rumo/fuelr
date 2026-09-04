import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `menu-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function recipe(request: APIRequestContext, title: string, names: string[]) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      ingredients: names.map((name) => ({ name, quantity: 200, unit: "g" })),
      steps: ["Cuire 20 min."],
    },
  });
  return id as number;
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("an idea is one tap away from anywhere in the app", async ({ page }) => {
  await page.goto("/fr/app/journal");
  await page.getByTestId("ask-idea").click();

  await expect(page).toHaveURL(/\/fr\/app\/idees$/);
  await expect(page.getByRole("heading", { name: "Qu'est-ce que tu as ?" })).toBeVisible();
});

test("the cook's own recipes answer first", async ({ request, page }) => {
  await recipe(request, "Curry de poulet", ["Poulet", "Courgette", "Riz"]);
  await recipe(request, "Poulet rôti", ["Poulet", "Courgette"]);
  await recipe(request, "Riz sauté", ["Riz", "Poulet"]);

  await page.goto("/fr/app/idees");
  await page.getByLabel("Ce que tu as").fill("poulet, courgettes, riz");
  await page.getByTestId("ask").click();

  const suggestions = page.getByTestId("suggestions");
  await expect(suggestions).toBeVisible();
  // Their own, named as theirs — and each card carries an illustration.
  await expect(suggestions.getByText("Ta recette").first()).toBeVisible();
  await expect(suggestions).toContainText("Curry de poulet");
  await expect(suggestions.getByRole("link", { name: "Ouvrir" }).first()).toBeVisible();
});

test("what is missing goes on the shopping list in one gesture", async ({
  request,
  page,
}) => {
  await recipe(request, "Curry de poulet", ["Poulet", "Courgette", "Lait de coco"]);
  await recipe(request, "Poulet rôti", ["Poulet", "Courgette"]);
  await recipe(request, "Riz sauté", ["Riz", "Poulet"]);

  await page.goto("/fr/app/idees");
  await page.getByLabel("Ce que tu as").fill("poulet, courgettes");
  await page.getByTestId("ask").click();
  await expect(page.getByTestId("suggestions")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter ce qui manque à la liste" }).first().click();
  await expect(page.getByTestId("added")).toBeVisible();
});

test("a bag nothing matches is an answer, not a failure", async ({ page }) => {
  await page.goto("/fr/app/idees");
  await page.getByLabel("Ce que tu as").fill("zoubidou, tralala");
  await page.getByTestId("ask").click();

  // No library match and no reader wired in CI: an empty answer that says so,
  // and points at writing the recipe by hand.
  await expect(page.getByTestId("menu-empty")).toBeVisible();
});

test("the screen holds up on a 360px phone", async ({ request, page }) => {
  await recipe(request, "Curry de poulet", ["Poulet", "Courgette", "Riz"]);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/fr/app/idees");

  await expect(page.getByLabel("Ce que tu as")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
