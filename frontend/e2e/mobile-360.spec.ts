import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

/**
 * The phone floor.
 *
 * 360×640 is the narrowest screen the app claims to support, and everything
 * here is geometry rather than markup: a class list cannot say whether a
 * control ended up 36px or 44px tall, because which of two competing Tailwind
 * utilities wins is decided by the stylesheet's order. So this suite measures
 * what the browser drew.
 *
 * Three things are asserted on every screen: the page does not scroll
 * sideways, every control is at least 44px tall, and the bottom of a dialog
 * can be reached on a short screen.
 */
const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";

/** Apple's floor and Google's, which agree at 44 CSS pixels. */
const TARGET = 44;

let token = "";

test.use({ viewport: { width: 360, height: 640 } });

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
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
      ingredients: [{ name: "Lentilles corail", quantity: 200, unit: "g" }],
      steps: ["Rincer les lentilles.", "Cuire 20 min à feu doux."],
    },
  });
  return id as number;
}

/** How far the page can be pushed sideways. Anything above 0 is a bug. */
function overflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * Every control the browser actually painted, that is shorter than the floor.
 *
 * Links written inside a sentence are exempt: an inline link is as tall as its
 * line by definition, and padding one to 44px would tear the paragraph apart.
 * Everything with a box of its own — buttons, chips, links that look like
 * buttons — has no such excuse.
 */
async function shortTargets(page: Page) {
  return page.evaluate((floor) => {
    const found: string[] = [];
    const controls = document.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], summary',
    );
    for (const control of controls) {
      const style = getComputedStyle(control);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Written into a sentence rather than placed on the page.
      if (style.display === "inline") continue;
      const box = control.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.height >= floor) continue;
      const label = (control.getAttribute("aria-label") ?? control.textContent ?? "")
        .trim()
        .slice(0, 40);
      found.push(`${control.tagName.toLowerCase()} "${label}" — ${Math.round(box.height)}px`);
    }
    return found;
  }, TARGET);
}

async function holdsUp(page: Page) {
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await shortTargets(page)).toEqual([]);
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("the library holds up, with its filters folded away", async ({ request, page }) => {
  await seed(request, "Dahl de lentilles corail au lait de coco et coriandre");
  await page.goto("/fr/app");

  // Eleven rows of chips are not what somebody opens the app to read.
  await expect(page.getByTestId("toggle-filters")).toBeVisible();
  await expect(page.getByRole("button", { name: "Végétarien" })).toBeHidden();
  await holdsUp(page);

  await page.getByTestId("toggle-filters").click();
  await expect(page.getByRole("button", { name: "Végétarien" })).toBeVisible();
  await holdsUp(page);
});

test("the planner offers a day rather than seven empty slots", async ({
  request,
  page,
}) => {
  await seed(request, "Dahl de lentilles");
  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await expect(page.getByTestId("week-grid")).toBeVisible();

  // The 21 empty slots of a blank week are 21 rows of nothing on a phone.
  await expect(page.getByTestId(`add-day-${MONDAY}`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ajouter un repas — lundi, / }),
  ).toBeHidden();
  await holdsUp(page);

  // And the day's picker asks which meal, since the slot was not chosen.
  await page.getByTestId(`add-day-${MONDAY}`).click();
  await expect(page.getByTestId("picker-slots")).toBeVisible();
  await holdsUp(page);
});

test("a dialog can be read to its bottom on a short screen", async ({
  request,
  page,
}) => {
  const recipe = await seed(request, "Dahl de lentilles");
  await request.post(`${BACKEND}/api/plan`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { date: MONDAY, slot: "DINNER", recipeId: recipe, servings: 4 },
  });

  // A phone in landscape, or any phone with the keyboard open.
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto(`/fr/app/planning?week=${MONDAY}`);
  await page.getByTestId("week-grid").getByRole("button", { name: /Dahl/ }).click();

  const remove = page.getByRole("button", { name: "Retirer du planning" });
  await expect(remove).toBeVisible();
  // Visible to Playwright is not the same as reachable: what matters is that
  // scrolling gets there, and that the page itself never moved sideways.
  await remove.scrollIntoViewIfNeeded();
  const box = await remove.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(480);
  await holdsUp(page);
});

test("the shopping list holds up", async ({ request, page }) => {
  const recipe = await seed(request, "Dahl de lentilles");
  await request.post(`${BACKEND}/api/plan`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { date: MONDAY, slot: "DINNER", recipeId: recipe, servings: 4 },
  });
  await page.goto(`/fr/app/courses?week=${MONDAY}`);
  await expect(page.getByTestId("shopping-week")).toBeVisible();

  await holdsUp(page);
});

test("the journal puts the meals before the settings", async ({ page }) => {
  await page.goto("/fr/app/journal");
  await expect(page.getByTestId("entries")).toBeVisible();

  // What somebody opens a diary to read comes before what they configure once.
  const entries = await page.getByTestId("entries").boundingBox();
  const history = await page.getByTestId("history").boundingBox();
  expect(entries!.y).toBeLessThan(history!.y);
  await holdsUp(page);
});

test("the editor holds up, on every tab", async ({ request, page }) => {
  const recipe = await seed(request, "Dahl de lentilles corail au lait de coco");
  await page.goto(`/fr/app/recettes/${recipe}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await holdsUp(page);

  await page.getByRole("button", { name: /Ingrédients/ }).click();
  await holdsUp(page);

  await page.getByRole("button", { name: /Étapes/ }).click();
  await holdsUp(page);
});

test("cooking mode holds up, and keeps its footer on screen", async ({
  request,
  page,
}) => {
  const recipe = await seed(request, "Dahl de lentilles corail au lait de coco");
  await page.goto(`/fr/app/recettes/${recipe}/cuisiner`);
  await expect(page.getByTestId("cook-progress")).toBeVisible();

  await holdsUp(page);
  // The footer stacks rather than clipping the primary action off the edge.
  const next = page.getByRole("button", { name: /Suivante/ });
  const box = await next.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
});

test("the household screen holds up", async ({ page }) => {
  await page.goto("/fr/app/foyer");
  await expect(page.getByTestId("members")).toBeVisible();

  await holdsUp(page);
});
