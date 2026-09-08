import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `suggest-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

/** A published recipe, with a cuisine and a tag so it can be asked for. */
async function seed(
  request: APIRequestContext,
  title: string,
  ingredient: string,
  extra: Record<string, unknown> = {},
) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      cuisine: "ITALIAN",
      tags: ["vegetarian"],
      ingredients: [{ name: ingredient, quantity: 200, unit: "g" }],
      steps: ["Cuire 20 min."],
      ...extra,
    },
  });
  return id as number;
}

async function openWeek(page: Page) {
  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await expect(page.getByTestId("week-grid")).toBeVisible();
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("filling the week never proposes what is already in the library", async ({
  request,
  page,
}) => {
  // Three recipes that match the ask exactly. Under the old rule they would
  // have been proposed for free; under this one the model is the only source,
  // and no model is reachable from this suite.
  await seed(request, "Risotto aux champignons", "Riz");
  await seed(request, "Minestrone", "Haricots");
  await seed(request, "Pâtes au pesto", "Pâtes");

  await openWeek(page);
  await page.getByTestId("open-suggest").click();
  await page.getByTestId("suggest-week").click();

  const dialog = page.getByTestId("suggest-dialog");
  await dialog.getByRole("button", { name: "Italienne" }).click();
  await dialog.getByRole("button", { name: "Proposer une semaine" }).click();

  // A refusal has a name. Which name depends on the environment — no key
  // here, a key that cannot be billed in CI — and both are honest answers.
  const declined = dialog.getByTestId("declined");
  await expect(declined).toBeVisible();
  await expect(declined).toContainText(/pas encore branchée|Aucune proposition/);

  // None of the three recipes was proposed, and nothing was written.
  await expect(dialog.getByTestId("proposals").locator("li")).toHaveCount(0);
  const planned = await request.get(`${BACKEND}/api/plan?week=${MONDAY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await planned.json()).meals).toHaveLength(0);
});

test("a meal somebody already has everything for buys nothing", async ({
  request,
  page,
}) => {
  const risotto = await seed(request, "Risotto", "Riz");
  const soupe = await seed(request, "Soupe", "Poireaux");
  for (const [date, recipeId] of [
    [MONDAY, risotto],
    ["2026-03-03", soupe],
  ] as const) {
    await request.post(`${BACKEND}/api/plan`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { date, slot: "DINNER", recipeId, servings: 4 },
    });
  }

  await page.goto(`/fr/app/courses?week=${MONDAY}`);
  await expect(page.getByText("Riz", { exact: true })).toBeVisible();

  // Fold open what the list is buying for, and take one meal out of it.
  const meals = page.getByTestId("shopping-meals");
  await meals.locator("summary").click();
  // The input is visually hidden behind its own styled box, so the label is
  // what a person clicks and what the test clicks too.
  await meals.locator("label").filter({ hasText: "Risotto" }).click();
  await expect(meals.getByLabel(/Risotto/)).toBeChecked();

  await expect(page.getByTestId("excluded-count")).toHaveText(/1 retiré/);
  // Its line is gone; the other meal's is untouched.
  await expect(page.getByText("Riz", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Poireaux", { exact: true })).toBeVisible();

  // And the meal is still on the plan: this was about a cupboard, not a dinner.
  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await expect(page.getByTestId("week-grid").getByText("Risotto")).toBeVisible();
});
