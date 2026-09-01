import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function answerEverything(page: Page) {
  await page.goto("/fr/commencer");
  await page.getByRole("button", { name: /Perdre du poids/ }).click();

  await page.getByLabel("Âge").fill("30");
  await page.getByRole("button", { name: "Femme" }).click();
  await page.getByLabel("Taille (cm)").fill("168");
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByLabel("Poids (kg)").fill("62");
  await page.getByRole("button", { name: /Modérée/ }).click();
  await page.getByRole("button", { name: "Voir mon résultat" }).click();
}

test("the numbers come before the account, not after", async ({ page }) => {
  await answerEverything(page);

  // The whole point: a real result with no sign-up in the way.
  await expect(page.getByTestId("onboarding-targets")).toBeVisible();
  await expect(page).toHaveURL(/\/fr\/commencer$/);

  const kcal = await page
    .getByTestId("onboarding-targets")
    .locator(".tnum")
    .first()
    .textContent();
  expect(Number(kcal)).toBeGreaterThan(1200);
});

test("no step asks for more than three things", async ({ page }) => {
  await page.goto("/fr/commencer");
  await page.getByRole("button", { name: /Maintenir/ }).click();

  // Age, sex, height — and nothing else on the screen.
  await expect(page.getByRole("textbox").or(page.locator("input[type=number]"))).toHaveCount(2);
  await expect(page.getByRole("group")).toHaveCount(1);
});

test("the answers survive closing the tab", async ({ page }) => {
  await page.goto("/fr/commencer");
  await page.getByRole("button", { name: /Prendre du poids/ }).click();
  await page.getByLabel("Âge").fill("41");

  // Same browser, fresh load — as if they had come back tomorrow.
  await page.goto("/fr/commencer");
  await expect(page.getByTestId("onboarding-resume")).toBeVisible();

  await page.getByRole("button", { name: /Prendre du poids/ }).click();
  await expect(page.getByLabel("Âge")).toHaveValue("41");
});

test("creating the account keeps the profile that was just filled in", async ({
  page,
  request,
}) => {
  await answerEverything(page);
  await expect(page.getByTestId("onboarding-targets")).toBeVisible();

  await page.getByRole("link", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/fr\/inscription$/);

  const email = `onboard-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  await page.getByLabel("Prénom").fill("Chef");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/);

  // Asserted against the stored profile, not the screen: the point is that the
  // answers reached the account, not that a page said so.
  const cookies = await page.context().cookies("http://localhost:3000");
  const token = cookies.find((c) => c.name === "fuelr_token")!.value;
  const saved = await request.get(`${BACKEND}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(saved.status()).toBe(200);
  const { profile } = await saved.json();
  expect(profile).toMatchObject({
    goal: "LOSE",
    age: 30,
    sex: "FEMALE",
    heightCm: 168,
    weightKg: 62,
    activity: "MODERATE",
  });
});

test("going back keeps what was already answered", async ({ page }) => {
  await answerEverything(page);
  await expect(page.getByTestId("onboarding-targets")).toBeVisible();

  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page.getByLabel("Poids (kg)")).toHaveValue("62");

  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page.getByLabel("Âge")).toHaveValue("30");
});

test("the journey holds up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await answerEverything(page);
  await expect(page.getByTestId("onboarding-targets")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
