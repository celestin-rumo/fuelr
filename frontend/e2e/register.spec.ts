import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8026";
const PASSWORD = "motdepasse123";

function freshEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
}

async function verificationLinkFor(request: APIRequestContext, email: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await request.get(`${MAILPIT}/api/v1/search?query=to:${email}`);
    const { messages } = await search.json();
    const welcome = messages.find((m: { Subject: string }) =>
      m.Subject.includes("Confirme"),
    );
    if (welcome) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${welcome.ID}`);
      const { Text } = await message.json();
      return new URL(/http\S+/.exec(Text)![0]);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No confirmation email arrived for ${email}`);
}

test("signing up lands straight in the product, already signed in", async ({ page }) => {
  await page.goto("/fr/inscription");
  await page.getByLabel("Prénom").fill("Chef");
  await page.getByLabel("Email").fill(freshEmail("signup"));
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  // No second sign-in step: the password was just chosen.
  await expect(page).toHaveURL(/\/fr\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour");
});

test("the strength meter says what is missing, not just how strong", async ({ page }) => {
  await page.goto("/fr/inscription");
  const password = page.getByLabel("Mot de passe");

  await password.fill("court");
  await expect(page.getByTestId("strength-label")).toHaveText("Trop court");

  await password.fill("motdepasse");
  await expect(page.getByTestId("strength-label")).toHaveText("Faible");

  await password.fill("Motdepasse12");
  await expect(page.getByTestId("strength-label")).toHaveText("Excellent");

  // Every rule met is shown as met, so the advice is actionable.
  await expect(page.locator("li[data-met=true]")).toHaveCount(4);
});

test("an address already used says so under the field, with a way onward", async ({
  page,
  request,
}) => {
  const email = freshEmail("taken");
  await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: PASSWORD, locale: "fr" },
  });

  await page.goto("/fr/inscription");
  await page.getByLabel("Prénom").fill("Chef");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByTestId("email-taken")).toContainText("existe déjà");

  // And the way out carries the address, so it is not typed twice.
  await page.getByTestId("email-taken").getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/connexion\?email=/);
  await expect(page.getByLabel("Email")).toHaveValue(email);
});

test("an unverified account works, and is asked once to confirm", async ({
  page,
  request,
}) => {
  const email = freshEmail("banner");
  await page.goto("/fr/inscription");
  await page.getByLabel("Prénom").fill("Chef");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/);

  // Asked, not blocked: the banner is there and so is the product.
  await expect(page.getByTestId("verify-banner")).toContainText(email);
  await page.getByRole("link", { name: "Nouvelle recette" }).first().click();
  await expect(page).toHaveURL(/\/fr\/app\/recettes\/\d+$/);

  const link = await verificationLinkFor(request, email);
  expect(link.pathname).toBe("/fr/verification-email");

  await page.goto(link.pathname + link.search);
  await expect(page.getByTestId("verify-done")).toBeVisible();

  // Once proven, the banner is gone for good.
  await page.getByRole("button", { name: "Aller à mes recettes" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/);
  await expect(page.getByTestId("verify-banner")).toHaveCount(0);
});

test("a dead confirmation link says so rather than pretending", async ({ page }) => {
  await page.goto("/fr/verification-email?token=pas-un-vrai-jeton");
  await expect(page.getByTestId("verify-failed")).toBeVisible();
});

test("the sign-up screen holds up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/fr/inscription");
  await page.getByLabel("Mot de passe").fill("Motdepasse12");

  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await expect(page.getByTestId("strength-label")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the confirmation banner does not push the app sideways on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 720 });

  await page.goto("/fr/inscription");
  await page.getByLabel("Prénom").fill("Chef");
  await page.getByLabel("Email").fill(freshEmail("banner-mobile"));
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByTestId("verify-banner")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
