import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `import-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  await context.addCookies([
    { name: "fuelr_token", value: (await response.json()).token, url: "http://localhost:3000" },
  ]);
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("the library offers importing beside creating", async ({ page }) => {
  await page.goto("/fr/app");
  await page.getByRole("link", { name: "Importer" }).first().click();
  await expect(page).toHaveURL(/\/fr\/app\/recettes\/importer$/);
});

test("a link that is not a link is refused before any request", async ({ page }) => {
  await page.goto("/fr/app/recettes/importer");
  await page.getByLabel("Lien de la recette").fill("marmiton.org");
  await page.getByRole("button", { name: "Importer" }).click();

  await expect(page.getByTestId("import-error")).toContainText("Ce n'est pas un lien");
  await expect(page).toHaveURL(/\/fr\/app\/recettes\/importer$/);
});

test("an unreachable page says so and is not a dead end", async ({ page }) => {
  await page.goto("/fr/app/recettes/importer");
  // Refused by the fetcher before it leaves the network — a private address is
  // exactly what this endpoint must never be talked into visiting.
  await page.getByLabel("Lien de la recette").fill("http://127.0.0.1:1/rien");
  await page.getByRole("button", { name: "Importer" }).click();

  await expect(page.getByTestId("import-error")).toBeVisible();

  // The way out is always on screen, not only after a failure.
  await page.getByRole("link", { name: "Saisir la recette à la main" }).click();
  await expect(page).toHaveURL(/\/fr\/app\/recettes\/\d+$/);
});

test("the three ways in are offered, and the assisted one says it is a gift", async ({
  page,
}) => {
  await page.goto("/fr/app/recettes/importer");

  await expect(page.getByTestId("import-sources")).toBeVisible();
  await expect(page.getByTestId("source-URL")).toHaveAttribute("aria-pressed", "true");

  // Reading a photo is billed to us per read, and it is open anyway while
  // nothing is charged: what bounds it is a monthly ceiling, not a plan.
  //
  // Whether a reader is actually wired is an environment fact — CI runs with
  // no key on purpose, since every read is billed — so what is asserted is the
  // rule rather than one configuration: picking the source never yields a dead
  // button, and never a paywall while nothing is charged.
  await page.getByTestId("source-PHOTO").click();
  await expect(page.getByTestId("import-closed-PLAN")).toHaveCount(0);

  const files = page.getByLabel("Photos de la recette");
  if (await files.count()) {
    // A reader is wired: the form is offered, and says it is a gift.
    await expect(files).toBeVisible();
    await expect(page.getByTestId("launch-note")).toContainText(
      "Offert pendant le lancement",
    );
  } else {
    // None is: the reason is named, and it is ours rather than the cook's.
    await expect(page.getByTestId("import-closed-SOON")).toContainText(
      "Pas encore branché",
    );
  }

  // The link is still one tap away.
  await page.getByTestId("source-URL").click();
  await expect(page.getByLabel("Lien de la recette")).toBeVisible();
});

test("manual entry is offered before trying anything", async ({ page }) => {
  await page.goto("/fr/app/recettes/importer");
  await expect(
    page.getByRole("link", { name: "Saisir la recette à la main" }),
  ).toBeVisible();
});

test("the import screen holds up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/fr/app/recettes/importer");

  await expect(page.getByLabel("Lien de la recette")).toBeVisible();
  await expect(page.getByRole("button", { name: "Importer" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
