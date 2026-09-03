import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `saison-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function seed(request: APIRequestContext, title: string, seasons: string[]) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      seasons,
      ingredients: [{ name: "Courge", quantity: 300, unit: "g" }],
      steps: ["Cuire 20 min."],
    },
  });
  return id as number;
}

/** Northern hemisphere, like the app. */
function currentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "Printemps";
  if (month >= 6 && month <= 8) return "Été";
  if (month >= 9 && month <= 11) return "Automne";
  return "Hiver";
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("a recipe carries none, one or several seasons", async ({ request, page }) => {
  const soup = await seed(request, "Soupe de courge", []);
  await page.goto(`/fr/app/recettes/${soup}`);

  const picker = page.getByTestId("season-picker");
  await picker.getByRole("button", { name: "Automne" }).click();
  await picker.getByRole("button", { name: "Hiver" }).click();

  // Autosaved: no button to press, so this waits for the row to change rather
  // than for a label. "Enregistré" is also what a complete recipe says at
  // rest, which makes it useless as a signal that a save just happened.
  await expect
    .poll(async () => {
      const response = await request.get(`${BACKEND}/api/recipes/${soup}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return ((await response.json()).seasons as string[]).sort();
    })
    .toEqual(["AUTUMN", "WINTER"]);

  await page.reload();
  await expect(
    page.getByTestId("season-picker").getByRole("button", { name: "Automne" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("season-picker").getByRole("button", { name: "Hiver" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the library filters by season, beside the filters already there", async ({
  request,
  page,
}) => {
  await seed(request, "Soupe de courge", ["AUTUMN", "WINTER"]);
  await seed(request, "Salade de tomates", ["SUMMER"]);
  await seed(request, "Pâtes au beurre", []);
  await page.goto("/fr/app");

  await page.getByTestId("season-filters").getByRole("button", { name: "Été" }).click();

  await expect(page.getByRole("heading", { name: "Salade de tomates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Soupe de courge" })).toHaveCount(0);
  // The filter lives in the URL, like the others, so it can be shared.
  await expect(page).toHaveURL(/seasons=SUMMER/);
});

test("asking for two seasons asks for either, not both", async ({ request, page }) => {
  await seed(request, "Soupe de courge", ["AUTUMN", "WINTER"]);
  await seed(request, "Salade de tomates", ["SUMMER"]);
  await page.goto("/fr/app");

  const filters = page.getByTestId("season-filters");
  await filters.getByRole("button", { name: "Automne" }).click();
  await filters.getByRole("button", { name: "Été" }).click();

  // Both recipes, and the squash soup once rather than twice.
  await expect(page.getByRole("heading", { name: "Soupe de courge" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Salade de tomates" })).toHaveCount(1);
});

test("the in-season shortcut picks the season the date is in", async ({
  request,
  page,
}) => {
  await seed(request, "Plat de saison", [
    { Printemps: "SPRING", Été: "SUMMER", Automne: "AUTUMN", Hiver: "WINTER" }[
      currentSeason()
    ]!,
  ]);
  await seed(request, "Plat d'une autre saison", [
    currentSeason() === "Été" ? "WINTER" : "SUMMER",
  ]);
  await page.goto("/fr/app");

  await page.getByTestId("in-season").click();

  await expect(page.getByRole("heading", { name: "Plat de saison" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Plat d'une autre saison" }),
  ).toHaveCount(0);
});

test("season filters, it does not reorder", async ({ request, page }) => {
  await seed(request, "Alpha", ["SUMMER"]);
  await seed(request, "Beta", ["SUMMER"]);
  await page.goto("/fr/app");

  const before = await page.getByTestId("recipe-grid").locator("li h3").allTextContents();
  await page.getByTestId("season-filters").getByRole("button", { name: "Été" }).click();
  await expect(page).toHaveURL(/seasons=SUMMER/);

  const after = await page.getByTestId("recipe-grid").locator("li h3").allTextContents();
  // Same recipes, same order: the default sort is not the season's business.
  expect(after).toEqual(before);
});

test("clearing takes the season with it", async ({ request, page }) => {
  await seed(request, "Soupe de courge", ["AUTUMN"]);
  await seed(request, "Salade de tomates", ["SUMMER"]);
  await page.goto("/fr/app");

  await page.getByTestId("season-filters").getByRole("button", { name: "Été" }).click();
  await expect(page.getByRole("heading", { name: "Soupe de courge" })).toHaveCount(0);

  await page.getByRole("button", { name: "Tout effacer" }).click();
  await expect(page.getByRole("heading", { name: "Soupe de courge" })).toBeVisible();
});

test("the season filters hold up on a phone", async ({ request, page }) => {
  await seed(request, "Soupe de courge", ["AUTUMN"]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/fr/app");

  // Folded away until asked for: eleven rows of chips are not what somebody
  // opens the app to read.
  await expect(page.getByTestId("season-filters")).toBeHidden();
  await page.getByTestId("toggle-filters").click();
  await expect(page.getByTestId("season-filters")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
