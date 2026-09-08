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

test("asking for a batch names its refusal rather than proposing your own recipes", async ({
  request,
  page,
}) => {
  // Four recipes that would have made a perfect set. None is proposed: a
  // batch is a request for dishes nobody has had, and no model is reachable
  // from this suite.
  const lentils = [{ name: "Lentilles corail", quantity: 300, unit: "g" }];
  await seed(request, "Dahl", lentils);
  await seed(request, "Soupe de lentilles", lentils);
  await seed(request, "Salade de lentilles", lentils);
  await seed(request, "Galettes de lentilles", lentils);

  await openWeek(page);
  await page.getByTestId("open-suggest").click();
  await page.getByTestId("suggest-batch").click();
  const dialog = page.getByTestId("batch-dialog");
  await dialog.getByRole("button", { name: "Chercher un ensemble" }).click();

  const declined = dialog.getByTestId("declined");
  await expect(declined).toBeVisible();
  await expect(declined).toContainText(/pas encore branchée|écarté|Réessayez/);
  await expect(dialog.getByTestId("batch-sets")).toHaveCount(0);
  await expect(page.getByTestId("week-grid").getByText("Dahl")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Plus d'actions" }).click();
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

