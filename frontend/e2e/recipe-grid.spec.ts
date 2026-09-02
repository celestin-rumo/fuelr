import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `grid-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

/** Seeds a recipe through the API, so the grid tests are not editor tests. */
async function seed(
  request: APIRequestContext,
  title: string,
  body: Record<string, unknown> = {},
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
      ingredients: [{ name: "Riz", quantity: 400, unit: "g" }],
      steps: ["Cuire 15 min.", "Servir."],
      ...body,
    },
  });
  return id as number;
}

test("an explicit empty state when there is no recipe", async ({ request, context, page }) => {
  await signIn(request, context);
  await page.goto("/fr/app");

  await expect(
    page.getByRole("heading", { name: "Aucune recette pour l'instant" }),
  ).toBeVisible();
  await expect(page.getByTestId("recipe-grid")).toHaveCount(0);
});

test("a card carries its title, meta and figures", async ({ request, context, page }) => {
  await signIn(request, context);
  const id = await seed(request, "Curry de lentilles");
  await page.goto("/fr/app");

  const card = page.getByTestId(`recipe-${id}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Curry de lentilles");
  // 2 steps: "15 min" + one with no duration counted as 3 → 18 min.
  await expect(card).toContainText("4 personnes · 18 min");
  // The figure comes from a published table this suite does not own; what
  // matters on a card is that there is one, and that it is per serving.
  await expect(card).toContainText(/\d+(\.\d)? kcal/);
});

test("a card marks figures that rest on an estimate", async ({ request, context, page }) => {
  await signIn(request, context);
  const known = await seed(request, "Riz nature");
  // "Racine de yuzu confite" used to be unknown and is now matched on
  // "racine"; a brand is what no composition table will ever publish.
  const guessed = await seed(request, "Plat mystère", {
    ingredients: [{ name: "Zoubidou 3000", quantity: 100, unit: "g" }],
  });
  await page.goto("/fr/app");

  await expect(page.getByTestId(`estimated-${guessed}`)).toBeVisible();
  await expect(page.getByTestId(`estimated-${known}`)).toHaveCount(0);
});

test("pinning flips immediately and without a reload", async ({ request, context, page }) => {
  await signIn(request, context);
  const id = await seed(request, "Curry");
  await page.goto("/fr/app");

  const pin = page.getByRole("button", { name: "Épingler Curry" });
  await expect(pin).toHaveAttribute("aria-pressed", "false");

  await pin.click();

  // Immediate: the same document, flipped, before the server has answered.
  await expect(
    page.getByRole("button", { name: "Retirer Curry des favoris" }),
  ).toHaveAttribute("aria-pressed", "true");

  // And it must STAY flipped once the transition settles: useOptimistic
  // discards its value when the action finishes, so without a refresh of the
  // server data the pin silently springs back.
  await page.waitForTimeout(2000);
  await expect(
    page.getByRole("button", { name: "Retirer Curry des favoris" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Favoris/ })).toContainText("1");

  // The write follows. Poll rather than read once — the optimistic flip is
  // deliberately ahead of it.
  await expect
    .poll(async () => {
      const response = await request.get(`${BACKEND}/api/recipes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stored = await response.json();
      return stored.find((r: { id: number }) => r.id === id)?.favorite;
    }, { timeout: 10_000 })
    .toBe(true);
});

test("pinned recipes come first", async ({ request, context, page }) => {
  await signIn(request, context);
  await seed(request, "Première");
  await seed(request, "Seconde");
  await page.goto("/fr/app");

  // Most recently touched first, so "Seconde" leads before anything is pinned.
  const titles = page.getByTestId("recipe-grid").locator("li h3");
  await expect(titles.first()).toContainText("Seconde");

  await page.getByRole("button", { name: "Épingler Première" }).click();

  await expect(titles.first()).toContainText("Première");
});

test("the favourites filter narrows the grid", async ({ request, context, page }) => {
  await signIn(request, context);
  await seed(request, "Épinglée");
  await seed(request, "Ordinaire");
  await page.goto("/fr/app");

  await page.getByRole("button", { name: "Épingler Épinglée" }).click();
  await page.getByRole("button", { name: /^Favoris/ }).click();

  await expect(page.getByText("Épinglée")).toBeVisible();
  await expect(page.getByText("Ordinaire")).toHaveCount(0);

  await page.getByRole("button", { name: "Toutes" }).click();
  await expect(page.getByText("Ordinaire")).toBeVisible();
});
