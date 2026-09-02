import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `cook-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

/** A recipe straight through the API: the editor has its own suite. */
async function createRecipe(
  request: APIRequestContext,
  body: Record<string, unknown>,
) {
  const draft = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  const { id } = await draft.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  return id as number;
}

const CURRY = {
  title: "Curry de lentilles corail",
  servings: 4,
  ingredients: [
    { name: "Lentilles corail", quantity: 200, unit: "g", needsReview: false },
    { name: "Lait de coco", quantity: 400, unit: "ml", needsReview: false },
  ],
  steps: [
    "Rincer les lentilles à l'eau froide.",
    "Faire revenir l'oignon 5 min.",
    "Mijoter 20 min et servir.",
  ],
  tags: [],
};

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("cooking starts from the recipe and comes back to it", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request, CURRY);

  await page.goto(`/fr/app/recettes/${id}`);
  await page.getByTestId("cook-start").click();

  await expect(page).toHaveURL(new RegExp(`/fr/app/recettes/${id}/cuisiner$`));
  await expect(page.getByTestId("cook-step")).toHaveText(
    "Rincer les lentilles à l'eau froide.",
  );
  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 1 sur 3");

  // Nothing of the app's chrome comes along: no header, nothing to hit by
  // accident with the back of a hand.
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toHaveCount(0);

  await page.getByRole("button", { name: "Suivante" }).click();
  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 2 sur 3");

  await page.getByRole("link", { name: "Quitter le mode cuisine" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/app/recettes/${id}$`));
});

test("the last step finishes rather than offering another one", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request, CURRY);

  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await page.getByRole("button", { name: "Suivante" }).click();
  await page.getByRole("button", { name: "Suivante" }).click();

  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 3 sur 3");
  await expect(page.getByRole("button", { name: "Suivante" })).toHaveCount(0);
  await page.getByRole("link", { name: "Terminer" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/app/recettes/${id}$`));
});

test("a recipe with no step cannot be cooked, by button or by URL", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request, {
    ...CURRY,
    title: "Recette sans étape",
    steps: [],
  });

  await page.goto(`/fr/app/recettes/${id}`);
  await expect(page.getByTestId("cook-start")).toBeDisabled();
  await expect(page.getByText("Ajoute au moins une étape")).toBeVisible();

  // Typed or bookmarked, the URL lands back where the steps are written.
  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await expect(page).toHaveURL(new RegExp(`/fr/app/recettes/${id}\\?cook=no-steps$`));
  await expect(page.getByTestId("cook-no-steps")).toBeVisible();
});

test("the ingredients open over the step, scaled for tonight", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request, CURRY);
  // A phone on the counter, which is where the sheet exists at all.
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await page.getByRole("button", { name: "Ingrédients" }).click();

  const sheet = page.getByTestId("cook-ingredients");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("200 g")).toBeVisible();

  await page.getByRole("button", { name: "Une portion de plus" }).click();
  await page.getByRole("button", { name: "Une portion de plus" }).click();
  await expect(sheet.getByText("300 g")).toBeVisible();
  await expect(page.getByTestId("cook-scaled-notice")).toContainText(
    "La recette est pour 4 personnes",
  );

  // The step never moved while the sheet was open.
  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 1 sur 3");

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("a duration in the step becomes a timer that follows the cook", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request, CURRY);

  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  // Step one states no duration, so it offers nothing at all.
  await expect(page.getByTestId("cook-durations")).toHaveCount(0);

  await page.getByRole("button", { name: "Suivante" }).click();
  await page.getByRole("button", { name: "⏱ 5 min" }).click();

  const timer = page.getByTestId("cook-timer");
  await expect(timer).toContainText("Étape 2");
  await expect(timer).toContainText(/0[45]:\d\d/);

  // It belongs to the pan, not to the step on screen.
  await page.getByRole("button", { name: "Suivante" }).click();
  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 3 sur 3");
  await expect(timer).toBeVisible();
});

test("nothing scrolls sideways on a narrow phone, controls stay on screen", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request, {
    ...CURRY,
    steps: [
      // The imported step is the real case: 600 characters that must scroll
      // inside their own box rather than push the footer off the bottom.
      `Rincer les lentilles. ${"Remuer sans cesse pour que rien n'attache au fond de la casserole. ".repeat(
        9,
      )}`,
      "Servir.",
    ],
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/fr/app/recettes/${id}/cuisiner`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await expect(page.getByRole("button", { name: "Suivante" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Ingrédients" })).toBeInViewport();
});
