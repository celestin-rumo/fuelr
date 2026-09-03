import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";
const WEDNESDAY = "2026-03-04";
const NEXT_WEDNESDAY = "2026-03-11";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `plan-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function seed(request: APIRequestContext, title: string) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      ingredients: [{ name: "Lentilles", quantity: 200, unit: "g" }],
      steps: ["Cuire 20 min."],
    },
  });
  return id as number;
}

/** Opens the week that never moves, rather than whatever week it is today. */
async function openWeek(page: Page, week = MONDAY) {
  await page.goto(`/fr/app/planning?week=${week}`);
  await expect(page.getByTestId("week-grid")).toBeVisible();
}

async function planInto(page: Page, slot: string, day: string, title: string) {
  await page.getByRole("button", { name: `Ajouter un repas — ${day}, ${slot}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(title) }).click();
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("an empty week is seven ordinary days, not seven failures", async ({
  request,
  page,
}) => {
  // A library with recipes and a week with none: the empty grid is the state
  // under test, not the empty library, which has its own screen.
  await seed(request, "Curry de lentilles");
  await openWeek(page);

  await expect(page.getByTestId(`day-${MONDAY}`)).toBeVisible();
  await expect(page.getByTestId(`day-2026-03-08`)).toBeVisible();

  const dinner = page.getByTestId(`slot-${WEDNESDAY}-DINNER`);
  await expect(dinner).toContainText("Rien de prévu");
  // Nothing planned says so quietly: no banner, no error anywhere on the grid.
  await expect(page.getByTestId("week-grid").getByRole("alert")).toHaveCount(0);
});

test("a recipe lands on the slot it was asked for, and stays there", async ({
  request,
  page,
}) => {
  await seed(request, "Curry de lentilles");
  await openWeek(page);

  await planInto(page, "Dîner", "mercredi", "Curry de lentilles");

  const dinner = page.getByTestId(`slot-${WEDNESDAY}-DINNER`);
  await expect(dinner).toContainText("Curry de lentilles");
  // Stored, not held in the page: it survives a reload.
  await page.reload();
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText(
    "Curry de lentilles",
  );
});

test("portions follow the household, and the recipe's own servings are left alone", async ({
  request,
  page,
}) => {
  await seed(request, "Curry de lentilles");
  await openWeek(page);

  await page.getByRole("button", { name: "Une personne de plus dans le foyer" }).click();
  await expect(page.getByTestId("household-size")).toHaveText("3");

  await planInto(page, "Dîner", "mercredi", "Curry de lentilles");
  await page
    .getByRole("button", { name: /Modifier Curry de lentilles — mercredi, Dîner/ })
    .click();

  // Three at the table, out of a recipe written for four.
  await expect(page.getByTestId("meal-servings")).toHaveText("3");
  await expect(page.getByRole("dialog")).toContainText("Recette prévue pour 4 personnes");
});

test("portions change on one meal without touching the others", async ({
  request,
  page,
}) => {
  await seed(request, "Curry de lentilles");
  await openWeek(page);
  await planInto(page, "Dîner", "mercredi", "Curry de lentilles");
  await planInto(page, "Déjeuner", "jeudi", "Curry de lentilles");

  await page
    .getByRole("button", { name: /Modifier Curry de lentilles — mercredi, Dîner/ })
    .click();
  await page
    .getByRole("button", { name: "Une portion de plus pour Curry de lentilles" })
    .click();
  await expect(page.getByTestId("meal-servings")).toHaveText("3");

  await page.getByRole("button", { name: "Fermer" }).click();
  await page
    .getByRole("button", { name: /Modifier Curry de lentilles — jeudi, Déjeuner/ })
    .click();
  await expect(page.getByTestId("meal-servings")).toHaveText("2");
});

test("a meal moves to another day without being entered again", async ({
  request,
  page,
}) => {
  await seed(request, "Curry de lentilles");
  await openWeek(page);
  await planInto(page, "Dîner", "mercredi", "Curry de lentilles");

  await page
    .getByRole("button", { name: /Modifier Curry de lentilles — mercredi, Dîner/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "ven." }).click();
  await page.getByRole("button", { name: "Fermer" }).click();

  await expect(page.getByTestId(`slot-2026-03-06-DINNER`)).toContainText(
    "Curry de lentilles",
  );
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText(
    "Rien de prévu",
  );
});

test("removing a meal gives the slot back", async ({ request, page }) => {
  await seed(request, "Curry de lentilles");
  await openWeek(page);
  await planInto(page, "Dîner", "mercredi", "Curry de lentilles");

  await page
    .getByRole("button", { name: /Modifier Curry de lentilles — mercredi, Dîner/ })
    .click();
  await page.getByRole("button", { name: "Retirer du planning" }).click();

  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText(
    "Rien de prévu",
  );
});

test("a week copies forward, and asks before writing over one already planned", async ({
  request,
  page,
}) => {
  await seed(request, "Curry de lentilles");
  await openWeek(page);
  await planInto(page, "Dîner", "mercredi", "Curry de lentilles");

  await page.getByRole("button", { name: "Dupliquer vers la semaine suivante" }).click();

  // It lands on the week it just filled in, same weekday, same slot.
  await expect(page).toHaveURL(/week=2026-03-09/);
  await expect(page.getByTestId(`slot-${NEXT_WEDNESDAY}-DINNER`)).toContainText(
    "Curry de lentilles",
  );

  // Copying onto it a second time would lose what is there, so it asks.
  await openWeek(page);
  await page.getByRole("button", { name: "Dupliquer vers la semaine suivante" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("La semaine suivante est déjà planifiée");

  await dialog.getByRole("button", { name: "Remplacer" }).click();
  await expect(page).toHaveURL(/week=2026-03-09/);
  await expect(page.getByTestId(`slot-${NEXT_WEDNESDAY}-DINNER`)).toContainText(
    "Curry de lentilles",
  );
});

test("with nothing to plan with, it asks for a recipe rather than showing an empty grid", async ({
  page,
}) => {
  await page.goto(`/fr/app/planning?week=${MONDAY}`);

  await expect(
    page.getByRole("heading", { name: "Aucune recette à planifier" }),
  ).toBeVisible();
  await expect(page.getByTestId("week-grid")).toHaveCount(0);
});

test("the week holds up on a phone", async ({ request, page }) => {
  await seed(request, "Curry de lentilles");
  await page.setViewportSize({ width: 375, height: 812 });
  await openWeek(page);

  // A phone plans by the day: 21 empty slots are 21 rows of nothing, so the
  // day carries one button and the meal is chosen in the sheet.
  await page.getByTestId(`add-day-${WEDNESDAY}`).click();
  await page.getByTestId("picker-slots").getByRole("button", { name: "Dîner" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Curry de lentilles/ })
    .click();

  // The grid stacks instead of pushing the page sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText(
    "Curry de lentilles",
  );
});

test("the plan is reachable from the header of every app screen", async ({ page }) => {
  await page.goto("/fr/app");

  await page.getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Planning" })
    .click();

  await expect(page).toHaveURL(/\/fr\/app\/planning/);
  await expect(page.getByRole("heading", { name: "Ma semaine" })).toBeVisible();
});
