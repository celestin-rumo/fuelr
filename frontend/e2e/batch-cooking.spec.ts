import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";
const TUESDAY = "2026-03-03";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function seed(
  request: APIRequestContext,
  title: string,
  ingredients: { name: string; quantity: number; unit: string }[],
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
      totalMinutes: 30,
      ingredients,
      steps: ["Cuire 20 min."],
      ...extra,
    },
  });
  return id as number;
}

async function plan(request: APIRequestContext, date: string, recipeId: number) {
  await request.post(`${BACKEND}/api/plan`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { date, slot: "DINNER", recipeId, servings: 4 },
  });
}

async function openWeek(page: Page) {
  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await expect(page.getByTestId("week-grid")).toBeVisible();
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("a set is proposed with what it shares, and lands on chosen days", async ({
  request,
  page,
}) => {
  // Four, because the dialog asks for four by default.
  const lentils = [{ name: "Lentilles corail", quantity: 300, unit: "g" }];
  await seed(request, "Dahl", lentils);
  await seed(request, "Soupe de lentilles", lentils);
  await seed(request, "Salade de lentilles", lentils);
  await seed(request, "Galettes de lentilles", lentils);

  await openWeek(page);
  await page.getByTestId("suggest-batch").click();

  const dialog = page.getByTestId("batch-dialog");
  await dialog.getByRole("button", { name: "Chercher un ensemble" }).click();

  // The set says what makes it one — counted, not asserted.
  const card = dialog.getByTestId("batch-set-0");
  await expect(card).toBeVisible();
  await expect(card).toContainText(/4 plats sur 4 sont bâtis sur Lentilles corail/);
  await expect(card).toContainText(/1200 g pour 4 plats/);
  // The library answered, so nothing says a model was asked.
  await expect(dialog.getByText(/vient d'un modèle/)).toHaveCount(0);

  // Choosing a set writes nothing: the days are still a question.
  await dialog.getByTestId("choose-set-0").click();
  await expect(dialog.getByTestId("batch-placements")).toBeVisible();
  await expect(page.getByTestId("week-grid").getByText("Dahl")).toHaveCount(0);

  await dialog.getByTestId("place-batch").click();
  await expect(dialog.getByTestId("to-prep")).toBeVisible();
  await dialog.getByRole("button", { name: "Rester sur le planning" }).click();

  const week = await (
    await request.get(`${BACKEND}/api/plan?week=${MONDAY}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  expect(week.meals).toHaveLength(4);
});

test("dishes that share only an onion are not called a batch", async ({
  request,
  page,
}) => {
  await seed(request, "Plat A", [
    { name: "Oignon", quantity: 1, unit: "pcs" },
    { name: "Poulet", quantity: 300, unit: "g" },
  ]);
  await seed(request, "Plat B", [
    { name: "Oignon", quantity: 1, unit: "pcs" },
    { name: "Cabillaud", quantity: 300, unit: "g" },
  ]);
  await seed(request, "Plat C", [
    { name: "Oignon", quantity: 1, unit: "pcs" },
    { name: "Tofu", quantity: 300, unit: "g" },
  ]);
  // A fourth, so the refusal is about the onion rather than about the count.
  await seed(request, "Plat D", [
    { name: "Oignon", quantity: 1, unit: "pcs" },
    { name: "Pois chiches", quantity: 300, unit: "g" },
  ]);

  await openWeek(page);
  await page.getByTestId("suggest-batch").click();
  const dialog = page.getByTestId("batch-dialog");
  await dialog.getByRole("button", { name: "Chercher un ensemble" }).click();

  // Peeling three onions on Sunday saves nobody anything, and the screen says
  // so without calling a varied library an error.
  await expect(dialog.getByText(/pas une erreur/)).toBeVisible();
  await expect(dialog.getByTestId("batch-sets")).toHaveCount(0);
});

test("the week already planned is read as one afternoon's work", async ({
  request,
  page,
}) => {
  await plan(request, MONDAY, await seed(request, "Dahl", [
    { name: "Lentilles", quantity: 300, unit: "g" },
    { name: "Curry", quantity: 1, unit: "c.à.s" },
  ]));
  await plan(request, TUESDAY, await seed(request, "Soupe", [
    { name: "Lentilles", quantity: 200, unit: "g" },
  ]));

  await openWeek(page);
  await page.getByTestId("to-prep-session").click();

  // Prepared once, for the whole week, with the total to actually make.
  const bases = page.getByTestId("prep-bases");
  await expect(bases).toContainText("Lentilles");
  await expect(bases).toContainText("500 g");
  await expect(bases).toContainText(/Dahl · Soupe|Soupe · Dahl/);

  // And what the bases already made is not asked for a second time.
  const dishes = page.getByTestId("prep-dishes");
  await expect(dishes).toContainText("1 c.à.s Curry");
  await expect(dishes.getByText("Lentilles")).toHaveCount(0);

  // The one health claim this application refuses to make.
  await expect(page.getByTestId("prep-keeping"))
    .toContainText(/ne connaît pas les durées de conservation/);
});

