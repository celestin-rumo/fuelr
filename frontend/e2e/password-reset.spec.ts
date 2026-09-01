import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8026";
const PASSWORD = "motdepasse123";

async function accountFor(request: APIRequestContext) {
  const email = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: PASSWORD },
  });
  return email;
}

/**
 * Pulls the link out of the message that actually left the application.
 * Reading the database instead would skip the part most likely to be wrong:
 * whether the email carries a usable URL at all.
 *
 * Navigating it verbatim is not possible here — it is absolute, built from the
 * backend's SITE_URL, which names the port the app answers on for the person
 * at the keyboard, not the one Playwright serves. Tests below check the whole
 * URL and then visit its path.
 */
async function linkSentTo(request: APIRequestContext, email: string) {
  // The send is asynchronous, so the message may not be there on the first ask.
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await request.get(`${MAILPIT}/api/v1/search?query=to:${email}`);
    const { messages } = await search.json();
    if (messages.length > 0) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
      const { Text } = await message.json();
      return new URL(/http\S+/.exec(Text)![0]);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No reset email arrived for ${email}`);
}

test("a forgotten password can be reset from the link in the email", async ({
  page,
  request,
}) => {
  const email = await accountFor(request);

  await page.goto("/fr/connexion");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page).toHaveURL(/\/fr\/mot-de-passe-oublie$/);

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByTestId("forgot-sent")).toContainText(email);

  const link = await linkSentTo(request, email);
  expect(link.pathname).toBe("/fr/nouveau-mot-de-passe");
  expect(link.searchParams.get("token")).toBeTruthy();

  await page.goto(link.pathname + link.search);
  await page.getByLabel("Nouveau mot de passe").fill("toutnouveaumdp");
  await page.getByLabel("Confirme le mot de passe").fill("toutnouveaumdp");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByTestId("reset-done")).toBeVisible();

  // The new password is the one that works now.
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("toutnouveaumdp");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/);
});

test("the same link cannot be used twice", async ({ page, request }) => {
  const email = await accountFor(request);

  await page.goto("/fr/mot-de-passe-oublie");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByTestId("forgot-sent")).toBeVisible();

  const link = await linkSentTo(request, email);
  const path = link.pathname + link.search;

  await page.goto(path);
  await page.getByLabel("Nouveau mot de passe").fill("premiernouveau");
  await page.getByLabel("Confirme le mot de passe").fill("premiernouveau");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByTestId("reset-done")).toBeVisible();

  await page.goto(path);
  await page.getByLabel("Nouveau mot de passe").fill("secondnouveau");
  await page.getByLabel("Confirme le mot de passe").fill("secondnouveau");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByTestId("reset-error")).toContainText("déjà servi");
});

test("an unknown address is confirmed exactly like a known one", async ({
  page,
  request,
}) => {
  const known = await accountFor(request);

  await page.goto("/fr/mot-de-passe-oublie");
  await page.getByLabel("Email").fill(known);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  const forKnown = await page.getByTestId("forgot-sent").textContent();

  const unknown = `personne-${Date.now()}@fuelr.app`;
  await page.goto("/fr/mot-de-passe-oublie");
  await page.getByLabel("Email").fill(unknown);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  const forUnknown = await page.getByTestId("forgot-sent").textContent();

  // Same sentence, only the address differs. Anything else would tell a
  // stranger which addresses have an account here.
  expect(forUnknown!.replace(unknown, "@")).toBe(forKnown!.replace(known, "@"));
});

test("a link without a token offers a way out instead of an error", async ({ page }) => {
  await page.goto("/fr/nouveau-mot-de-passe");
  await expect(page.getByTestId("reset-no-token")).toBeVisible();

  await page.getByRole("link", { name: "Demander un nouveau lien" }).click();
  await expect(page).toHaveURL(/\/fr\/mot-de-passe-oublie$/);
});

test("both reset screens hold up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });

  for (const path of ["/fr/mot-de-passe-oublie", "/fr/nouveau-mot-de-passe?token=peu-importe"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} déborde`).toBeLessThanOrEqual(0);
  }

  await expect(page.getByLabel("Nouveau mot de passe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer le mot de passe" })).toBeVisible();
});
