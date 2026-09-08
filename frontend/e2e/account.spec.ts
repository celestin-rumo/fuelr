import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8026";

function freshEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
}

async function register(request: APIRequestContext, context: BrowserContext) {
  const email = freshEmail("compte");
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Céline", password: "motdepasse123", locale: "fr" },
  });
  const token = (await response.json()).token as string;
  await context.addCookies([{ name: "fuelr_token", value: token, url: "http://localhost:3000" }]);
  return { email, token };
}

/** The last mail Mailpit holds for an address, with its text. */
async function lastMailTo(request: APIRequestContext, to: string, subject: RegExp) {
  await expect
    .poll(async () => {
      const search = await request.get(`${MAILPIT}/api/v1/search?query=to:${to}`);
      const { messages } = await search.json();
      return messages.some((m: { Subject: string }) => subject.test(m.Subject));
    })
    .toBe(true);
  const search = await request.get(`${MAILPIT}/api/v1/search?query=to:${to}`);
  const { messages } = await search.json();
  const hit = messages.find((m: { Subject: string }) => subject.test(m.Subject));
  const message = await request.get(`${MAILPIT}/api/v1/message/${hit.ID}`);
  return (await message.json()).Text as string;
}

test("the name is the account's, and saved without a button", async ({ request, context, page }) => {
  await register(request, context);
  await page.goto("/fr/app/compte/profil");

  const name = page.getByTestId("account-name");
  await name.fill("Camille");
  await name.press("Enter");
  await expect(page.getByTestId("account-notice")).toContainText("Enregistré.");

  // The header reads it back: it is the account, not the form, that changed.
  await page.reload();
  await expect(page.getByTestId("account-link")).toContainText("Camille");
});

test("the language follows the account, and the page follows the language", async ({
  request,
  context,
  page,
}) => {
  const { token } = await register(request, context);
  await page.goto("/fr/app/compte/profil");

  await page.getByRole("button", { name: "Deutsch" }).click();
  await expect(page).toHaveURL(/\/de\/app\/konto\/profil/);
  await expect(page.getByTestId("account-back")).toContainText("Zurück");

  const me = await request.get(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await me.json()).locale).toBe("de");
});

test("changing the password signs the other device out and tells the address", async ({
  request,
  context,
  page,
}) => {
  const { email } = await register(request, context);
  // A second device: another login for the same account.
  const phone = await request.post(`${BACKEND}/api/auth/login`, {
    data: { email, password: "motdepasse123" },
  });
  const phoneToken = (await phone.json()).token as string;

  await page.goto("/fr/app/compte/profil");
  await page.getByTestId("disclosure-password").locator("summary").click();
  await page.getByTestId("password-current").fill("motdepasse123");
  await page.getByTestId("password-next").fill("nouveaumotdepasse");
  await page.getByTestId("password-submit").click();
  await expect(page.getByTestId("account-notice")).toContainText(/autres appareils/);

  // The phone is out; this browser is still in.
  const gone = await request.get(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${phoneToken}` },
  });
  expect(gone.status()).toBe(401);
  await page.reload();
  await expect(page.getByTestId("account-back")).toBeVisible();

  const text = await lastMailTo(request, email, /mot de passe.*chang/i);
  expect(text).toContain("autres appareils");
});

test("an address moves only when the new one clicks, and the old one is told", async ({
  request,
  context,
  page,
}) => {
  const { email, token } = await register(request, context);
  const next = freshEmail("nouvelle");

  await page.goto("/fr/app/compte/profil");
  await page.getByTestId("email-new").fill(next);
  await page.getByTestId("email-password").fill("motdepasse123");
  await page.getByTestId("email-submit").click();
  await expect(page.getByTestId("email-change-sent")).toContainText(next);

  // Asked for, not done.
  let me = await request.get(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await me.json()).email).toBe(email);

  // The old address was told; the new one got the link.
  const notice = await lastMailTo(request, email, /changement d'adresse/i);
  expect(notice).toContain("Rien ne change");
  const mail = await lastMailTo(request, next, /nouvelle adresse/i);
  const link = mail.match(/https?:\/\/\S+\/changement-email\?token=\S+/)?.[0];
  expect(link, "the mail carries the link").toBeTruthy();

  // The click, on a device with no session at all.
  await context.clearCookies();
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  await expect(page.getByTestId("email-change-done")).toBeVisible();

  me = await request.get(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const after = await me.json();
  expect(after.email).toBe(next);
  expect(after.emailVerified).toBe(true);
});

test("the devices are listed in words, and one closed from here is out", async ({
  request,
  context,
  page,
}) => {
  const { email } = await register(request, context);
  const phone = await request.post(`${BACKEND}/api/auth/login`, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1" },
    data: { email, password: "motdepasse123" },
  });
  const phoneToken = (await phone.json()).token as string;

  await page.goto("/fr/app/compte/securite");
  const panel = page.getByTestId("devices-panel");
  await expect(panel).toContainText("Safari · iOS");
  await expect(panel).toContainText("Cet appareil");
  await expect(panel).not.toContainText("Mozilla/5.0");

  await panel.getByRole("button", { name: /Fermer la session sur Safari/ }).click();
  await expect(panel).not.toContainText("Safari · iOS");

  const gone = await request.get(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${phoneToken}` },
  });
  expect(gone.status()).toBe(401);
});

test("a session closed elsewhere lands on a login page that says so", async ({
  request,
  context,
  page,
}) => {
  const { token } = await register(request, context);
  // Closed from "another device": the API, with the same account's token.
  await request.post(`${BACKEND}/api/auth/logout`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await page.goto("/fr/app/compte");
  await expect(page).toHaveURL(/\/fr\/connexion\?reason=closed/);
  await expect(page.getByTestId("login-closed")).toContainText(/fermée depuis un autre appareil/);
});

test("everything I have leaves in one archive, once", async ({ request, context, page }) => {
  const { email, token } = await register(request, context);
  const created = await request.post(`${BACKEND}/api/recipes`, { headers: { Authorization: `Bearer ${token}` } });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "Risotto", servings: 4, ingredients: [{ name: "Riz", quantity: 200, unit: "g" }], steps: ["Cuire."] },
  });

  await page.goto("/fr/app/compte/donnees");
  await page.getByTestId("export-submit").click();
  await expect(page.getByTestId("export-asked")).toContainText(email);

  const mail = await lastMailTo(request, email, /export.*prêt/i);
  const link = mail.match(/https?:\/\/\S+\/export\?token=\S+/)?.[0];
  expect(link, "the mail carries the link").toBeTruthy();

  await context.clearCookies();
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  const href = await page.getByTestId("export-download").getAttribute("href");
  const zip = await request.get(`http://localhost:3000${href}`);
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toContain("application/zip");
  // Once.
  const again = await request.get(`http://localhost:3000${href}`);
  expect(again.status()).toBe(410);
});

test("deleting my account needs my password, says what goes, and then I am gone", async ({
  request,
  context,
  page,
}) => {
  const { email, token } = await register(request, context);

  await page.goto("/fr/app/compte/donnees");
  await page.getByTestId("delete-open").click();
  const dialog = page.getByTestId("delete-dialog");
  await expect(dialog).toContainText(/Aucune recette|recette/);

  await dialog.getByTestId("delete-password").fill("pasdutout");
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toContainText("Ce n'est pas votre mot de passe.");

  await dialog.getByTestId("delete-password").fill("motdepasse123");
  await dialog.getByTestId("delete-confirm").click();
  await expect(page).toHaveURL(/\/fr\/?$/);

  const me = await request.get(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(me.status()).toBe(401);
  const text = await lastMailTo(request, email, /supprimé/i);
  expect(text).toContain("supprimés");
});

test("a shared link is remembered for thirty days and counted, never named", async ({
  request,
  context,
  page,
}) => {
  const { token } = await register(request, context);
  await page.goto("/fr/app/compte/profil");
  await page.getByTestId("disclosure-recommend").locator("summary").click();
  const link = await page.getByTestId("referral-link").innerText();
  const code = new URL(link.trim()).searchParams.get("via");
  expect(code).toBeTruthy();
  await expect(page.getByTestId("referral-count")).toContainText("Personne n'est encore venu");

  // Somebody follows the link and registers a week later.
  await context.clearCookies();
  await page.goto(`/?via=${code}`);
  await expect(page).toHaveURL(/\/fr/);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "fuelr_via")?.value).toBe(code);

  await page.goto("/fr/inscription");
  await page.getByLabel("Prénom").fill("Camille");
  await page.getByLabel("Email").fill(freshEmail("venue"));
  await page.getByLabel("Mot de passe").fill("motdepasse123");
  await page.getByRole("button", { name: /Créer mon compte|Continuer/ }).click();
  await expect(page).toHaveURL(/\/fr\/(app|demarrer|start)/);

  const referral = await request.get(`${BACKEND}/api/account/referral`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await referral.json();
  expect(body.referred).toBe(1);
  expect(JSON.stringify(body)).not.toContain("venue");
});

test("the weekly reminder is off, turns on, and stops from the mail", async ({
  request,
  context,
  page,
}) => {
  const { token } = await register(request, context);
  await page.goto("/fr/app/compte/preferences");
  await page.getByTestId("disclosure-reminder").locator("summary").click();
  const panel = page.getByTestId("reminder-panel");
  await expect(panel.getByTestId("reminder-switch")).not.toBeChecked();

  // The input is visually hidden behind its styled track, so the label is
  // what a person clicks and what the test clicks too.
  await panel.locator("label").filter({ hasText: "Me rappeler" }).click();
  await expect(panel.getByTestId("reminder-switch")).toBeChecked();
  await expect(panel.getByText("Quel jour")).toBeVisible();
  // The screen shows the choice at once; the server has it a moment later.
  await expect
    .poll(async () =>
      (await (await request.get(`${BACKEND}/api/account/reminder`, {
        headers: { Authorization: `Bearer ${token}` },
      })).json()).day,
    )
    .toBe(7);
});

test("the account is an identity, then cards to choose a section", async ({ request, context, page }) => {
  const { email } = await register(request, context);
  await page.goto("/fr/app/compte");

  const header = page.getByTestId("account-header");
  await expect(header).toContainText("Céline");
  await expect(header).toContainText(email);

  // Five cards, grouped, each a page of its own; the destructive one last.
  for (const key of ["profile", "preferences", "household", "security", "data"]) {
    await expect(page.getByTestId(`account-card-${key}`)).toBeVisible();
  }
  await expect(page.getByTestId("account-status-security")).toContainText("1 appareil");
  await expect(page.getByTestId("delete-open")).toHaveCount(0);

  await page.getByTestId("account-card-data").click();
  await expect(page).toHaveURL(/\/fr\/app\/compte\/donnees/);
  await expect(page.getByTestId("delete-open")).toBeVisible();
  await page.getByTestId("account-back").click();
  await expect(page).toHaveURL(/\/fr\/app\/compte$/);

  // The household lives here now, and its old address still leads to it.
  await page.getByTestId("account-card-household").click();
  await expect(page.getByTestId("household-panel")).toBeVisible();
  await page.goto("/fr/app/foyer");
  await expect(page).toHaveURL(/\/fr\/app\/compte\/foyer/);
});
