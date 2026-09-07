import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { weekDays } from "../app/lib/week";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";
const WEDNESDAY = "2026-03-04";

let token = "";

/**
 * A print stylesheet is invisible in development: nobody looks at it until
 * somebody prints, and by then it has been broken for weeks. Playwright can
 * emulate the medium, which is what keeps that from happening here.
 */
async function onPaper(page: Page) {
  await page.emulateMedia({ media: "print" });
}

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `print-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function recipe(request: APIRequestContext) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Soupe de courge",
      description: "Une soupe d'automne.",
      servings: 4,
      ingredients: [
        { name: "Courge", quantity: 800, unit: "g" },
        { name: "Lait de coco", quantity: 400, unit: "ml" },
      ],
      steps: ["Éplucher la courge.", "Cuire 30 min.", "Mixer."],
    },
  });
  return id as number;
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("the recipe has a sheet of its own, reached from the editor", async ({
  request,
  page,
}) => {
  const id = await recipe(request);
  await page.goto(`/fr/app/recettes/${id}`);
  await page.getByTestId("print-recipe").click();
  await expect(page).toHaveURL(new RegExp(`/fr/app/recettes/${id}/imprimer$`));

  const sheet = page.getByTestId("print-sheet");
  await expect(sheet).toContainText("Soupe de courge");
  await expect(sheet).toContainText("4 personnes");
  // The whole recipe, not the tab that happens to be open: the editor renders
  // one panel at a time, which is exactly why the sheet is a page of its own.
  await expect(sheet).toContainText("800 g");
  await expect(sheet).toContainText("Lait de coco");
  await expect(sheet).toContainText("Mixer.");
});

test("on paper the toolbar goes and the app around it goes with it", async ({
  request,
  page,
}) => {
  const id = await recipe(request);
  await page.goto(`/fr/app/recettes/${id}/imprimer`);
  await expect(page.getByTestId("do-print")).toBeVisible();

  await onPaper(page);

  await expect(page.getByTestId("print-sheet")).toBeVisible();
  await expect(page.getByTestId("do-print")).toBeHidden();
  await expect(page.getByRole("navigation", { name: /principale/i })).toBeHidden();
});

test("the quantities printed are the ones on screen, servings included", async ({
  request,
  page,
}) => {
  const id = await recipe(request);
  await page.goto(`/fr/app/recettes/${id}`);

  // Raised on screen; the sheet must not hand back the recipe for four. The
  // editor autosaves, so the sheet reads what the database holds — which is
  // why this waits for the save rather than printing straight away.
  await page.getByRole("button", { name: "Une portion de plus" }).click();
  await page.getByRole("button", { name: "Une portion de plus" }).click();
  await expect(page.getByText("6 personnes")).toBeVisible();
  await expect
    .poll(async () => {
      const response = await request.get(`${BACKEND}/api/recipes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await response.json()).servings;
    })
    .toBe(6);

  await page.goto(`/fr/app/recettes/${id}/imprimer`);
  await expect(page.getByTestId("print-sheet")).toContainText("6 personnes");
});

test("the shopping list prints with a box to tick and the week on it", async ({
  request,
  page,
}) => {
  const id = await recipe(request);
  await request.post(`${BACKEND}/api/plan`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { date: WEDNESDAY, slot: "DINNER", recipeId: id, servings: 4 },
  });

  await page.goto(`/fr/app/courses?week=${MONDAY}`);
  await page.getByTestId("print-shopping").click();
  await expect(page).toHaveURL(/\/fr\/app\/courses\/imprimer/);

  const sheet = page.getByTestId("print-sheet");
  await expect(sheet).toContainText("Liste des commissions");
  // A list without a date is a list found in a bag three weeks later.
  await expect(sheet).toContainText("Semaine du 2 mars");
  await expect(sheet).toContainText("Courge");
  // Grouped by aisle, in the order a shop is walked — the whole point of that
  // order is the walk, and it does not change medium.
  await expect(sheet).toContainText("Fruits & légumes");
  await expect(sheet).toContainText("Crémerie");
});

test("the week prints as one landscape sheet for the fridge", async ({
  request,
  page,
}) => {
  const id = await recipe(request);
  // Two meals on the same evening and one on another, so the grid is not
  // trivially empty and the cells are actually exercised.
  for (const [date, slot] of [
    [MONDAY, "DINNER"],
    [MONDAY, "LUNCH"],
    [WEDNESDAY, "DINNER"],
  ] as const) {
    await request.post(`${BACKEND}/api/plan`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { date, slot, recipeId: id, servings: 4 },
    });
  }

  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await page.getByTestId("print-week").click();
  await expect(page).toHaveURL(/\/fr\/app\/planning\/imprimer/);

  const sheet = page.getByTestId("print-sheet");
  await expect(sheet).toContainText("Le planning de la semaine");
  // Read from a metre away, and the thing that says the sheet is a moment.
  await expect(sheet).toContainText("Du 2 mars au 8 mars");
  await expect(sheet).toContainText(/un repas déplacé depuis n'y figure pas/);

  // Seven days across, four meals down — every box, empty ones included.
  await expect(page.getByTestId("print-week-grid")).toBeVisible();
  await expect(page.getByTestId(`print-cell-${MONDAY}-DINNER`))
    .toContainText("Soupe de courge");
  await expect(page.getByTestId(`print-cell-${MONDAY}-BREAKFAST`)).toBeVisible();
  await expect(page.getByTestId("print-cell-2026-03-08-SNACK")).toBeVisible();

  // Nothing that addresses one person, and nothing that costs a page of ink.
  await expect(sheet.locator("img")).toHaveCount(0);
  await expect(sheet).not.toContainText("kcal");

  await onPaper(page);
  await expect(page.getByRole("navigation", { name: /principale/i })).toBeHidden();

  // Landscape is declared on this page and nowhere else: the recipe and the
  // list are read in the hand and belong in portrait.
  const declared = await page.evaluate(() =>
    [...document.querySelectorAll("style")]
      .map((one) => one.textContent ?? "")
      .join("\n"),
  );
  expect(declared).toContain("A4 landscape");

  await page.emulateMedia({ media: "screen" });

  // One sheet, always — and the claim is worth nothing on a week with three
  // meals on it, so the check is run on a full one.
  for (const date of weekDays(MONDAY)) {
    for (const slot of ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]) {
      await request.post(`${BACKEND}/api/plan`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { date, slot, recipeId: id, servings: 4 },
      });
    }
  }

  await page.goto(`/fr/app/planning/imprimer?week=${MONDAY}`);
  await expect(page.getByTestId("print-week-grid")).toBeVisible();

  // Measured on the rendered box rather than argued about. The preview is
  // 820px wide where landscape A4 gives 277mm, so its columns are narrower and
  // its titles wrap more — the height read here is the pessimistic one, and
  // fitting at this width means fitting on the paper.
  const box = await page.getByTestId("print-sheet").boundingBox();
  expect(box).not.toBeNull();
  const millimetres = (box!.height / 96) * 25.4;
  expect(millimetres).toBeLessThanOrEqual(190);
});

test("the work plan prints as a sheet, boxes and all", async ({ request, page }) => {
  const id = await recipe(request);
  for (const date of [MONDAY, WEDNESDAY]) {
    await request.post(`${BACKEND}/api/plan`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { date, slot: "DINNER", recipeId: id, servings: 4 },
    });
  }

  await page.goto(`/fr/app/planning/preparation?week=${MONDAY}`);
  await page.getByTestId("print-prep").click();
  await expect(page).toHaveURL(/\/fr\/app\/planning\/preparation\/imprimer/);

  const sheet = page.getByTestId("print-sheet");
  await expect(sheet).toContainText("Plan de travail");
  await expect(sheet).toContainText("Semaine du 2 mars");
  // The same dish twice: what is prepared once says so, with the total.
  await expect(sheet).toContainText("Bases communes");
  // And the one health claim this application refuses to make.
  await expect(sheet).toContainText(/ne connaît pas les durées de conservation/);

  // Two hours of cooking are done with a sheet, so the app around it goes.
  await onPaper(page);
  await expect(page.getByRole("navigation", { name: /principale/i })).toBeHidden();
});

test("the sheet is nowhere in the screens it came from", async ({
  request,
  page,
}) => {
  const id = await recipe(request);
  await page.goto(`/fr/app/recettes/${id}`);

  // Its own page, and only there: a sheet living inside every screen would be
  // a second copy of every word, which is how the first attempt broke eight
  // tests that had every right to expect one match.
  await expect(page.getByTestId("print-sheet")).toHaveCount(0);
  await expect(page.getByTestId("print-recipe")).toBeVisible();
});
