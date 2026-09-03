import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `journal-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

/** The Plus plan, through the same order endpoint a payment would use. */
async function subscribe(request: APIRequestContext) {
  const response = await request.post(`${BACKEND}/api/subscription/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { tier: "PLUS", period: "MONTHLY" },
  });
  expect(response.status()).toBe(202);
}

async function recipe(request: APIRequestContext, title: string, ingredient: string) {
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
      steps: ["Cuire 20 min."],
    },
  });
  return id as number;
}

async function openJournal(page: Page) {
  await page.goto("/fr/app/journal");
  await expect(page.getByTestId("journal-week")).toBeVisible();
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

// --- the diary, which is free -----------------------------------------------

test("a meal at a restaurant is written down without a recipe", async ({ page }) => {
  await openJournal(page);

  await page.getByLabel("Repas", { exact: true }).fill("Pizza chez Luigi");
  await page.getByLabel("kcal", { exact: true }).fill("900");
  await page.getByRole("button", { name: "Noter", exact: true }).click();

  await expect(page.getByTestId("entries")).toContainText("Pizza chez Luigi");
  await expect(page.getByTestId("entries")).toContainText("900 kcal");

  // Written down, not held in the page.
  await page.reload();
  await expect(page.getByTestId("entries")).toContainText("Pizza chez Luigi");
});

test("during the launch the whole diary is open, and says it is", async ({
  page,
}) => {
  await openJournal(page);

  // Nothing is charged yet, so nothing is withheld: the charts and the target
  // are there for an account that ordered nothing.
  await expect(page.getByTestId("log-form")).toBeVisible();
  await expect(page.getByTestId("charts")).toBeVisible();
  await expect(page.getByTestId("tracking-locked")).toHaveCount(0);

  // And the screen says it is a launch rather than letting it look owned.
  await expect(page.getByTestId("launch-note")).toContainText(
    "Offert pendant le lancement",
  );
});

test("nothing on this screen congratulates or scolds", async ({ request, page }) => {
  await subscribe(request);
  await openJournal(page);
  await page.getByLabel("Repas", { exact: true }).fill("Sandwich");
  await page.getByLabel("kcal", { exact: true }).fill("600");
  await page.getByRole("button", { name: "Noter", exact: true }).click();
  await expect(page.getByTestId("entries")).toContainText("Sandwich");

  const text = (await page.getByTestId("insights").textContent()) ?? "";
  expect(text).not.toMatch(/bravo|félicitations|série|bien joué|attention/i);
  // It says what is true about the week before it says anything about a gap.
  expect(text).toContain("jours notés sur 7");
});

// --- what the plan adds ------------------------------------------------------

test("with the plan the week is drawn, against a target that can be set", async ({
  request,
  page,
}) => {
  await subscribe(request);
  await openJournal(page);

  await page.getByLabel("Repas", { exact: true }).fill("Sandwich");
  await page.getByLabel("kcal", { exact: true }).fill("600");
  await page.getByRole("button", { name: "Noter", exact: true }).click();
  await expect(page.getByTestId("entries")).toContainText("Sandwich");

  await expect(page.getByTestId("charts")).toBeVisible();
  // One bar for the day written down, and no bar for the six that were not.
  await expect(page.getByTestId("charts").locator("rect")).toHaveCount(4);

  await page.getByLabel("kcal / jour").fill("2200");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("targets")).toContainText(
    "les chiffres que tu as fixés",
  );
});

test("the whole history is open while nothing is charged", async ({ page }) => {
  await openJournal(page);
  await page.getByRole("button", { name: "Voir les 90 derniers jours" }).click();

  // The 30-day window is a clamp the paid boundary applies, and the boundary
  // is off: ninety days means ninety days. That the window works, and gives
  // back everything it hid, is proven with the flag on in MealLogApiTest.
  await expect(page.getByTestId("history-windowed")).toHaveCount(0);
  await expect(page.getByTestId("history")).toBeVisible();
});

// --- energy on the recipe, which is free ------------------------------------

test("energy per serving is on the card, and a guess is marked as one", async ({
  request,
  page,
}) => {
  const known = await recipe(request, "Curry de lentilles", "Lentilles");
  const guessed = await recipe(request, "Plat mystère", "Zoubidou 3000");
  await page.goto("/fr/app");

  const card = page.getByTestId(`recipe-${known}`);
  await expect(card).toContainText("kcal");
  await expect(page.getByTestId(`estimated-${known}`)).toHaveCount(0);

  // A guessed figure never passes itself off as a measured one.
  await expect(page.getByTestId(`estimated-${guessed}`)).toBeVisible();
});

test("the nutrition detail opens without anybody having paid", async ({
  request,
  page,
}) => {
  const curry = await recipe(request, "Curry de lentilles", "Lentilles");
  await page.goto(`/fr/app/recettes/${curry}`);
  await page.getByRole("button", { name: /Ingrédients/ }).click();

  // It is a paid feature in the enum and an open one on the screen: which of
  // the two is one flag, and the flag is off while nothing is charged.
  await page.getByRole("button", { name: /Voir le détail/ }).click();
  await expect(page.getByTestId("detail-locked")).toHaveCount(0);

  const detail = page.getByTestId("nutrition-detail");
  await expect(detail).toContainText("Fibres");
  await expect(detail).toContainText("Fer");
  // The figures are somebody's, and the screen says whose.
  await expect(detail).toContainText("Base de données suisse");
});

test("the diary holds up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openJournal(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the diary is reachable from the header", async ({ page }) => {
  await page.goto("/fr/app");

  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Journal" })
    .click();

  await expect(page).toHaveURL(/\/fr\/app\/journal/);
  await expect(page.getByRole("heading", { name: "Mon journal" })).toBeVisible();
});
