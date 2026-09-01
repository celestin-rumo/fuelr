import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `lib-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
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
  ingredient: string,
  tags: string[] = [],
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
      ingredients: [{ name: ingredient, quantity: 100, unit: "g" }],
      steps: ["Cuire 10 min."],
      tags,
    },
  });
  return id as number;
}

async function pin(page: Page, title: string) {
  await page.getByRole("button", { name: `Épingler ${title}` }).click();
  await expect(
    page.getByRole("button", { name: `Retirer ${title} des favoris` }),
  ).toBeVisible();
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

// --- search and filters -------------------------------------------------

test("searching narrows the grid on the title", async ({ request, page }) => {
  await seed(request, "Curry de lentilles", "Lentilles");
  await seed(request, "Saumon grillé", "Saumon");
  await page.goto("/fr/app");

  await page.getByLabel("Chercher").fill("curry");

  await expect(page.getByRole("heading", { name: "Curry de lentilles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saumon grillé" })).toHaveCount(0);
  // The query lives in the URL, so the filtered view can be shared.
  await expect(page).toHaveURL(/[?&]q=curry/);
});

test("searching reaches the ingredients, not just the title", async ({ request, page }) => {
  await seed(request, "Plat du soir", "Lentilles corail");
  await seed(request, "Autre plat", "Saumon");
  await page.goto("/fr/app");

  await page.getByLabel("Chercher").fill("lentilles");

  await expect(page.getByRole("heading", { name: "Plat du soir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Autre plat" })).toHaveCount(0);
});

test("tags stack instead of widening the results", async ({ request, page }) => {
  await seed(request, "Les deux", "Tofu", ["vegetarian", "quick"]);
  await seed(request, "Un seul", "Riz", ["vegetarian"]);
  await page.goto("/fr/app");

  await page.getByRole("button", { name: "Végétarien" }).click();
  await expect(page.getByRole("heading", { name: "Un seul" })).toBeVisible();

  await page.getByRole("button", { name: "Rapide" }).click();

  await expect(page.getByRole("heading", { name: "Les deux" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Un seul" })).toHaveCount(0);
});

test("an empty result says so without pretending the library is empty", async ({
  request,
  page,
}) => {
  await seed(request, "Curry", "Lentilles");
  await page.goto("/fr/app");

  await page.getByLabel("Chercher").fill("introuvable");

  await expect(page.getByTestId("no-results")).toContainText("Aucune recette ne correspond");
  await expect(
    page.getByRole("heading", { name: "Aucune recette pour l'instant" }),
  ).toHaveCount(0);
});

// --- manual favourite order ---------------------------------------------

test("favourites can be ordered by hand, and it sticks", async ({ request, page }) => {
  await seed(request, "Alpha", "Riz");
  await seed(request, "Beta", "Riz");
  await page.goto("/fr/app");

  await pin(page, "Alpha");
  await pin(page, "Beta");

  const titles = page.getByTestId("recipe-grid").locator("li h3");
  await expect(titles.first()).toContainText("Alpha");

  await page.getByRole("button", { name: "Monter Beta dans les favoris" }).click();
  await expect(titles.first()).toContainText("Beta");

  // Survives a reload rather than living in component state.
  await page.reload();
  await expect(titles.first()).toContainText("Beta");
});

test("the ordering controls work from the keyboard", async ({ request, page }) => {
  await seed(request, "Alpha", "Riz");
  await seed(request, "Beta", "Riz");
  await page.goto("/fr/app");
  await pin(page, "Alpha");
  await pin(page, "Beta");

  const up = page.getByRole("button", { name: "Monter Beta dans les favoris" });
  // Briefly disabled while the optimistic order is replaced by the refreshed
  // one; focus would not take on a disabled control.
  await expect(up).toBeEnabled();
  await up.focus();
  await expect(up).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByTestId("recipe-grid").locator("li h3").first(),
  ).toContainText("Beta");
});

test("only pinned recipes carry ordering controls", async ({ request, page }) => {
  await seed(request, "Ordinaire", "Riz");
  await page.goto("/fr/app");

  await expect(
    page.getByRole("button", { name: "Monter Ordinaire dans les favoris" }),
  ).toHaveCount(0);
});

// --- duplicate ----------------------------------------------------------

test("a recipe can be duplicated, and the copy is independent", async ({ request, page }) => {
  await seed(request, "Curry", "Lentilles");
  await page.goto("/fr/app");

  await page.getByRole("button", { name: "Dupliquer Curry" }).click();

  await expect(page.getByRole("heading", { name: "Curry (copie)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Curry", exact: true })).toBeVisible();
});

// --- delete -------------------------------------------------------------

test("deleting asks first, and cancelling changes nothing", async ({ request, page }) => {
  await seed(request, "Curry", "Lentilles");
  await page.goto("/fr/app");

  await page.getByRole("button", { name: "Supprimer Curry" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Supprimer « Curry » ?");

  await dialog.getByRole("button", { name: "Annuler" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Curry" })).toBeVisible();
});

test("confirming removes the recipe", async ({ request, page }) => {
  await seed(request, "Curry", "Lentilles");
  await seed(request, "Saumon", "Saumon");
  await page.goto("/fr/app");

  await page.getByRole("button", { name: "Supprimer Curry" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();

  await expect(page.getByRole("heading", { name: "Curry" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Saumon" })).toBeVisible();
});

// --- export -------------------------------------------------------------

test("the whole library downloads as a readable file", async ({ request, page }) => {
  await seed(request, "Curry", "Lentilles");
  await page.goto("/fr/app");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Exporter" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("fuelr-recettes.json");

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  // Readable without Fuelr means the content is there, not just the titles.
  expect(exported).toHaveLength(1);
  expect(exported[0].title).toBe("Curry");
  expect(exported[0].ingredients[0].name).toBe("Lentilles");
  expect(exported[0].steps[0]).toBe("Cuire 10 min.");
});
