import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `prefs-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([{ name: "fuelr_token", value: token, url: "http://localhost:3000" }]);
}

async function seed(request: APIRequestContext, title: string, ingredient: string) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      ingredients: [{ name: ingredient, quantity: 200, unit: "g" }],
      steps: ["Cuire."],
    },
  });
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("what I do not eat is said once, and the library can be narrowed to it", async ({
  request,
  page,
}) => {
  await seed(request, "Gratin dauphinois", "Crème");
  await seed(request, "Salade de tomates", "Tomates");

  await page.goto("/fr/app/compte/preferences");
  const panel = page.getByTestId("preferences-panel");
  await panel.getByRole("button", { name: "Lait" }).click();
  await panel.getByRole("button", { name: "Végétarien" }).click();
  await panel.getByTestId("preferences-submit").click();
  await expect(panel.getByTestId("preferences-notice")).toContainText("enregistrées");

  // Kept on the account, not on the page.
  const saved = await (await request.get(`${BACKEND}/api/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  expect(saved).toMatchObject({ diet: "VEGETARIAN", allergens: ["MILK"] });

  // And the library applies it on the lines: the gratin names cream.
  await page.goto("/fr/app");
  await page.getByTestId("open-filters").click();
  await page.getByTestId("compatible-filter").click();
  await expect(page).toHaveURL(/compatible=1/);
  await expect(page.getByText("Salade de tomates")).toBeVisible();
  await expect(page.getByText("Gratin dauphinois")).toHaveCount(0);
});
