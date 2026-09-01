import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
const PASSWORD = "motdepasse123";

/** Creates an account through the API, then throws its session away. */
async function accountFor(request: APIRequestContext) {
  const email = `login-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: PASSWORD },
  });
  return email;
}

test("signing in from the form reaches the product", async ({ page, request }) => {
  const email = await accountFor(request);

  await page.goto("/fr/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/fr\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour");
});

test("the destination survives the whole round trip", async ({ page, request }) => {
  const email = await accountFor(request);

  // Ask for a deep page while signed out; the guard bounces to the form.
  await page.goto("/fr/app/recettes/nouvelle");
  await expect(page).toHaveURL(/\/fr\/connexion\?next=/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  // Back where they were headed, not to the app's front door.
  await expect(page).toHaveURL(/\/fr\/app\/recettes\/\d+$/);
});

test("wrong credentials say so without naming which half", async ({ page, request }) => {
  const email = await accountFor(request);

  await page.goto("/fr/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("paslebonmotdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByTestId("login-error")).toContainText("Identifiants incorrects");

  // An unknown address gets the very same message.
  await page.getByLabel("Email").fill("personne@fuelr.app");
  await page.getByLabel("Mot de passe").fill("paslebonmotdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("login-error")).toContainText("Identifiants incorrects");
});

test("repeated failures start a delay, and say how long", async ({ page, request }) => {
  const email = await accountFor(request);
  await page.goto("/fr/connexion");

  await page.getByLabel("Email").fill(email);
  for (let i = 0; i < 4; i++) {
    await page.getByLabel("Mot de passe").fill(`faux-${i}`);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();
  }

  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  // Held even with the right password, and the wait is stated.
  await expect(page.getByTestId("login-error")).toContainText("Trop de tentatives");
  await expect(page).toHaveURL(/\/fr\/connexion/);
});

test("signing out closes the session on the server, not just the browser", async ({
  page,
  request,
}) => {
  const email = await accountFor(request);

  await page.goto("/fr/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/);

  // Take a copy of the credential before signing out. Scoped to the app's own
  // origin on purpose: the API calls that seed the account set a cookie of the
  // same name on the backend's origin, and picking that one would revoke one
  // session while testing another.
  const cookies = await page.context().cookies("http://localhost:3000");
  const token = cookies.find((c) => c.name === "fuelr_token")!.value;
  expect(
    (await request.get(`${BACKEND}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })).status(),
  ).toBe(200);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/fr$/);

  // The copied token is dead too — the session is gone, not just the cookie.
  expect(
    (await request.get(`${BACKEND}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })).status(),
  ).toBe(401);

  await page.goto("/fr/app");
  await expect(page).toHaveURL(/\/fr\/connexion/);
});

test("the sign-in screen holds up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/fr/connexion");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
