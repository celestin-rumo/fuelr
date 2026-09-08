import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext , Page } from "@playwright/test";

/**
 * A cuisine is a closed domain, and that is the point.
 *
 * "Show me the Italian ones" has to be computable, and it is not if the value
 * is whatever somebody typed — which is the mistake this codebase already made
 * once, when an imported recipe tagged "soupe" became a recipe no filter could
 * find. So what is asserted here is mostly what the domain refuses.
 */
const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `cuisine-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function seed(request: APIRequestContext, title: string, cuisine: string | null) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      cuisine,
      ingredients: [{ name: "Riz", quantity: 200, unit: "g" }],
      steps: ["Cuire."],
    },
  });
  return id as number;
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});


/**
 * The filter panel is shut until somebody asks for it, at every width.
 *
 * Twenty-three chips is a wall in front of the library and a tab stop each;
 * what is on stays visible outside the panel as removable chips, which is what
 * makes hiding the rest allowed.
 */
async function openDrawer(page: Page) {
  if (!(await page.getByTestId("filters-drawer").isVisible())) {
    await page.getByTestId("open-filters").click();
  }
}

async function openFilters(page: Page, group: "tags" | "seasons" | "cuisines" | "origins") {
  await openDrawer(page);
  const door = page.getByTestId(`filter-${group}`);
  if ((await door.getAttribute("aria-expanded")) !== "true") {
    await door.click();
  }
}

test("a recipe carries at most one cuisine, and choosing it again clears it", async ({
  request,
  page,
}) => {
  const id = await seed(request, "Risotto", null);
  await page.goto(`/fr/app/recettes/${id}`);

  const picker = page.getByTestId("cuisine-picker");
  await picker.getByRole("button", { name: "Italienne" }).click();
  await expect(picker.getByRole("button", { name: "Italienne" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Choosing another replaces rather than adding: a dish is not of two
  // cuisines at a time.
  await picker.getByRole("button", { name: "Japonaise" }).click();
  await expect(picker.getByRole("button", { name: "Italienne" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(picker.getByRole("button", { name: "Japonaise" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // And the same one again clears it — "none" is the answer for most recipes,
  // so it needs no control of its own.
  await picker.getByRole("button", { name: "Japonaise" }).click();
  await expect(picker.getByRole("button", { name: "Japonaise" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("the library filters on it, and several means either", async ({
  request,
  page,
}) => {
  await seed(request, "Risotto milanais", "ITALIAN");
  await seed(request, "Ramen maison", "JAPANESE");
  await seed(request, "Gratin de courgettes", null);

  await page.goto("/fr/app");
  const titles = page.getByTestId("recipe-grid").locator("li h3");
  await expect(titles).toHaveCount(3);

  await openFilters(page, "cuisines");
  await page.getByTestId("cuisine-filters").getByRole("button", { name: "Italienne" }).click();
  await expect(titles).toHaveCount(1);
  await expect(titles.first()).toContainText("Risotto");

  // Two cuisines ask for either — a recipe carries at most one, so asking for
  // both could only ever be empty.
  await openFilters(page, "cuisines");
  await page.getByTestId("cuisine-filters").getByRole("button", { name: "Japonaise" }).click();
  await expect(titles).toHaveCount(2);

  // The dish from nowhere is not a gap: it simply has no cuisine.
  // Deselected one at a time, with the result awaited in between: each click
  // reads the props of the render it happened on, and two in a row race the
  // navigation the first one starts.
  await openFilters(page, "cuisines");
  await page.getByTestId("cuisine-filters").getByRole("button", { name: "Italienne" }).click();
  await expect(titles).toHaveCount(1);
  await openFilters(page, "cuisines");
  await page.getByTestId("cuisine-filters").getByRole("button", { name: "Japonaise" }).click();
  await expect(titles).toHaveCount(3);
});

test("a cuisine outside the domain is dropped, not stored", async ({ request }) => {
  // A value no filter could ever find is worse than no value at all.
  const id = await seed(request, "Poulet", "FUSION_ASIATIQUE");
  const body = await (
    await request.get(`${BACKEND}/api/recipes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  expect(body.cuisine).toBeNull();
});

test("a stale bookmark naming an unknown cuisine shows a library, not an error", async ({
  request,
  page,
}) => {
  await seed(request, "Risotto", "ITALIAN");
  const response = await page.goto("/fr/app?cuisines=ATLANTIDE");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("recipe-grid").locator("li h3")).toHaveCount(1);
});
