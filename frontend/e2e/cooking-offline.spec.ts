import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

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

async function createRecipe(request: APIRequestContext) {
  const draft = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  const { id } = await draft.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Curry de lentilles corail",
      servings: 4,
      ingredients: [
        { name: "Lentilles corail", quantity: 200, unit: "g", needsReview: false },
      ],
      steps: [
        "Rincer les lentilles à l'eau froide.",
        "Faire revenir l'oignon 5 min.",
        "Mijoter 20 min et servir.",
      ],
      tags: [],
    },
  });
  return id as number;
}

/** The worker only takes over once it has installed and claimed the page. */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  );
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("the dish under way survives a reload with no network", async ({
  page,
  context,
  request,
}) => {
  const id = await createRecipe(request);

  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await waitForServiceWorker(page);

  await page.getByRole("button", { name: "Suivante" }).click();
  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 2 sur 3");

  // The kitchen loses the network mid-recipe, and the phone is reloaded.
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId("cook-step")).toHaveText(
    "Faire revenir l'oignon 5 min.",
  );
  await expect(page.getByTestId("cook-progress")).toHaveText("Étape 2 sur 3");
  await expect(page.getByTestId("cook-offline")).toBeVisible();

  // Everything that matters still works: the steps, and the timer the step
  // states — neither ever needed the network.
  await page.getByRole("button", { name: "⏱ 5 min" }).click();
  await expect(page.getByTestId("cook-timer")).toContainText(/0[45]:\d\d/);

  await context.setOffline(false);
});

test("with nothing under way, offline says so instead of failing", async ({
  page,
  context,
}) => {
  await page.goto("/fr/app");
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.goto("/fr/app");

  // Not the browser's error page: the app's own, in the app's own language.
  await expect(page.getByText("Pas de réseau")).toBeVisible();
  await context.setOffline(false);
});

test("no page and no API answer is ever cached", async ({ page, request }) => {
  const id = await createRecipe(request);

  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await waitForServiceWorker(page);

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });

  // Only immutable, content-hashed assets and the offline shells. One
  // signed-in page in there would eventually be served to somebody else.
  for (const url of cached) {
    const path = new URL(url).pathname;
    expect(
      path.startsWith("/_next/static/") || /^\/(fr|en|de)\/offline$/.test(path),
      `unexpected cache entry: ${path}`,
    ).toBe(true);
  }
  expect(cached.some((url) => url.includes("/api/"))).toBe(false);
});

test("the app is installable, in the visitor's own language", async ({ page }) => {
  await page.goto("/fr/app");

  const href = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(href).toBe("/manifest/fr");

  const manifest = await page.request.get(href!);
  const body = await manifest.json();
  expect(body.name).toContain("Fuelr");
  expect(body.description).toContain("sans réseau");
  expect(body.start_url).toBe("/fr/app");
  expect(body.display).toBe("standalone");
  expect(body.icons.length).toBeGreaterThanOrEqual(2);
});
