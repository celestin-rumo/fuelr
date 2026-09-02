import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `etapes-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  await context.addCookies([
    {
      name: "fuelr_token",
      value: (await response.json()).token,
      url: "http://localhost:3000",
    },
  ]);
}

async function openSteps(page: Page) {
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: "Étapes" }).click();
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  return page.getByLabel("Étape 1", { exact: true });
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("a slash offers ready-made steps, and an arrow and Enter insert one", async ({
  page,
}) => {
  const step = await openSteps(page);
  await step.click();
  await step.pressSequentially("/prech");

  await expect(page.getByTestId("step-suggestions")).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(step).toHaveValue("Préchauffer le four à 180 °C.");
  await expect(page.getByTestId("step-suggestions")).toHaveCount(0);
});

test("what is inserted is text, and stays editable", async ({ page }) => {
  const step = await openSteps(page);
  await step.click();
  await step.pressSequentially("/mix");
  await page.keyboard.press("Enter");

  // The caret lands after the inserted text, so the numbers in it can be
  // corrected straight away.
  await step.pressSequentially(" Puis 45 s.");
  await expect(step).toHaveValue("Mixer 30 s / vitesse 4. Puis 45 s.");
});

test("a fraction stays typable", async ({ page }) => {
  const step = await openSteps(page);
  await step.click();
  await step.pressSequentially("Ajouter 1/2 citron");

  // No list, and nothing left open behind it.
  await expect(page.getByTestId("step-suggestions")).toHaveCount(0);
  await expect(step).toHaveValue("Ajouter 1/2 citron");
});

test("Escape closes the list and inserts nothing", async ({ page }) => {
  const step = await openSteps(page);
  await step.click();
  await step.pressSequentially("/mix");
  await expect(page.getByTestId("step-suggestions")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("step-suggestions")).toHaveCount(0);
  // The slash that was typed stays typed.
  await expect(step).toHaveValue("/mix");
});

test("the arrows walk the list", async ({ page }) => {
  const step = await openSteps(page);
  await step.click();
  await step.pressSequentially("/");
  await expect(page.getByTestId("step-suggestions")).toBeVisible();

  const first = await page.getByRole("option").first().textContent();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(step).not.toHaveValue(first ?? "");
  await expect(step).not.toHaveValue("");
});

test("on a phone the list stays above the keyboard's half of the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 400 });
  const step = await openSteps(page);
  await step.click();
  await step.pressSequentially("/");

  const list = page.getByTestId("step-suggestions");
  await expect(list).toBeVisible();

  // A short viewport stands in for the keyboard eating the bottom half: the
  // list has to open upwards rather than under it.
  const field = await step.boundingBox();
  const box = await list.boundingBox();
  expect(box!.y).toBeLessThan(field!.y);
});
