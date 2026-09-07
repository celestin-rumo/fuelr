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
  await page.goto("/fr/app/compte");

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
  await page.goto("/fr/app/compte");

  await page.getByRole("button", { name: "Deutsch" }).click();
  await expect(page).toHaveURL(/\/de\/app\/konto/);
  await expect(page.getByRole("heading", { name: "Mein Konto" })).toBeVisible();

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

  await page.goto("/fr/app/compte");
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
  await expect(page.getByTestId("account-panel")).toBeVisible();

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

  await page.goto("/fr/app/compte");
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
