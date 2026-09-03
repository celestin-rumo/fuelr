import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8026";

/** A fixed Monday, so nothing here depends on the day the suite runs. */
const MONDAY = "2026-03-02";
const WEDNESDAY = "2026-03-04";

type Account = { email: string; token: string };

function freshEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
}

async function register(request: APIRequestContext, prefix: string): Promise<Account> {
  const email = freshEmail(prefix);
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: prefix === "host" ? "Céline" : "Camille", password: "motdepasse123" },
  });
  return { email, token: (await response.json()).token };
}

/** Puts one account's token in the browser, replacing whoever was there. */
async function signIn(context: BrowserContext, account: Account) {
  await context.clearCookies();
  await context.addCookies([
    { name: "fuelr_token", value: account.token, url: "http://localhost:3000" },
  ]);
}

async function seedRecipe(request: APIRequestContext, account: Account, title: string) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${account.token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${account.token}` },
    data: {
      title,
      servings: 4,
      ingredients: [{ name: "Lentilles", quantity: 200, unit: "g" }],
      steps: ["Cuire 20 min."],
    },
  });
  return id as number;
}

async function planMeal(
  request: APIRequestContext,
  account: Account,
  date: string,
  slot: string,
  recipeId: number,
) {
  await request.post(`${BACKEND}/api/plan`, {
    headers: { Authorization: `Bearer ${account.token}` },
    data: { date, slot, recipeId },
  });
}

/** The Famille plan, through the same order endpoint a payment would use. */
async function subscribeToFamily(request: APIRequestContext, account: Account) {
  const response = await request.post(`${BACKEND}/api/subscription/orders`, {
    headers: { Authorization: `Bearer ${account.token}` },
    data: { tier: "FAMILY", period: "MONTHLY" },
  });
  expect(response.status()).toBe(202);
}

/** Reads the invitation out of the mail catcher, like a real invitee would. */
async function invitationLinkFor(request: APIRequestContext, email: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await request.get(`${MAILPIT}/api/v1/search?query=to:${email}`);
    const { messages } = await search.json();
    const invitation = messages.find((message: { Subject: string }) =>
      message.Subject.includes("foyer"),
    );
    if (invitation) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${invitation.ID}`);
      const { Text } = await message.json();
      return new URL(/http\S+/.exec(Text)![0]);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No invitation arrived for ${email}`);
}

async function openWeek(page: Page, week = MONDAY) {
  await page.goto(`/fr/app/planning?week=${week}`);
  await expect(page.getByTestId("week-grid")).toBeVisible();
}

// --- while nothing is charged -----------------------------------------------
//
// The app ships with `app.subscription.enforce` off: every feature is open and
// nothing is billed. What these two describe is therefore the launch, not the
// boundary — the boundary itself is proven with the flag on, in
// HouseholdSharingTest and the 402 paths of the backend suite.

test("a household is shared without anybody having paid, and says so", async ({
  request,
  context,
  page,
}) => {
  await signIn(context, await register(request, "solo"));
  await page.goto("/fr/app/foyer");

  // Nothing was ordered and the invitation field is there all the same.
  await expect(page.getByLabel("Inviter par email")).toBeVisible();
  // And the screen says it is a launch rather than letting it look owned.
  await expect(page.getByTestId("launch-note")).toContainText(
    "Offert pendant le lancement",
  );
  // And the way to what it will cost is on the note, since the card that used
  // to carry it is the one that disappears while everything is open.
  await expect(page.getByRole("link", { name: "Voir les plans" })).toBeVisible();
});

test("cancelling during the launch takes nothing away", async ({
  request,
  context,
  page,
}) => {
  const host = await register(request, "host");
  // Through the API: while everything is open there is nothing to buy, so the
  // screen offers no order button — which is the point of `canOrder`.
  await subscribeToFamily(request, host);
  await signIn(context, host);
  await page.goto("/fr/app/foyer");

  await page.getByTestId("cancel-plan").click();

  // The promise the pricing page makes, in its easiest place to break: the
  // household is still there, and so is everything in it.
  await expect(page.getByLabel("Inviter par email")).toBeVisible();
  await expect(page.getByTestId("members")).toBeVisible();
});

// --- one plan, two people ---------------------------------------------------

test("an invitation by email puts two accounts on the same week", async ({
  request,
  context,
  page,
}) => {
  const host = await register(request, "host");
  const guest = await register(request, "guest");
  await subscribeToFamily(request, host);
  const curry = await seedRecipe(request, host, "Curry du foyer");
  await planMeal(request, host, WEDNESDAY, "DINNER", curry);

  await signIn(context, host);
  await page.goto("/fr/app/foyer");
  await page.getByLabel("Inviter par email").fill(guest.email);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByTestId("invited")).toContainText(guest.email);

  // The invitee follows the link out of their mail.
  const link = await invitationLinkFor(request, guest.email);
  await signIn(context, guest);
  await page.goto(link.pathname + link.search);
  await page.getByRole("button", { name: "Rejoindre le foyer" }).click();

  await expect(page.getByTestId("members")).toContainText("Céline");
  await expect(page.getByTestId("members")).toContainText("Camille");

  // And the week is the same week.
  await openWeek(page);
  await expect(page.getByTestId("shared-plan")).toContainText("2 comptes");
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText("Curry du foyer");
});

test("a member sees who planned what, and can open that recipe", async ({
  request,
  context,
  page,
}) => {
  const { host, guest } = await share(request);

  await signIn(context, guest);
  await openWeek(page);
  await page
    .getByRole("button", { name: /Modifier Curry du foyer — mercredi, Dîner/ })
    .click();

  await expect(page.getByTestId("planned-by")).toContainText("Céline");

  // A dish on the shared plan opens; the rest of that library does not.
  await page.getByRole("link", { name: "Voir la recette" }).click();
  await expect(page.getByRole("heading", { name: "Curry du foyer" })).toBeVisible();

  const hidden = await seedRecipe(request, host, "Gardée pour moi");
  const response = await page.goto(`/fr/app/recettes/${hidden}`);
  expect(response?.status()).toBe(404);
});

test("what a member plans shows up for everyone", async ({ request, context, page }) => {
  const { host, guest } = await share(request);
  await seedRecipe(request, guest, "Saumon de Camille");

  await signIn(context, guest);
  await openWeek(page);
  await page.getByRole("button", { name: /Ajouter un repas — jeudi, Dîner/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Saumon de Camille/ })
    .click();
  await expect(page.getByTestId("slot-2026-03-05-DINNER")).toContainText("Saumon de Camille");

  await signIn(context, host);
  await openWeek(page);
  await expect(page.getByTestId("slot-2026-03-05-DINNER")).toContainText("Saumon de Camille");
});

// --- losing the plan --------------------------------------------------------

test("cancelling the plan deletes nothing, for anybody", async ({
  request,
  context,
  page,
}) => {
  const { host, guest } = await share(request);

  await signIn(context, host);
  await page.goto("/fr/app/foyer");
  await page.getByTestId("cancel-plan").click();

  // Nothing is charged, so cancelling changes no access — and that is the
  // half worth asserting here anyway: every row is still where it was. That
  // a lapsed member falls back to their own untouched plan is the boundary's
  // own behaviour, and HouseholdSharingTest proves it with the flag on.
  await signIn(context, guest);
  await openWeek(page);
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText("Curry du foyer");

  await signIn(context, host);
  await openWeek(page);
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText("Curry du foyer");
});

test("leaving a household puts someone back in front of their own plan", async ({
  request,
  context,
  page,
}) => {
  const { guest } = await share(request);

  await signIn(context, guest);
  await page.goto("/fr/app/foyer");
  await page.getByRole("button", { name: "Quitter le foyer" }).click();
  await page.getByRole("button", { name: "Quitter", exact: true }).click();

  await expect(page.getByTestId("members")).toContainText("Camille");
  await expect(page.getByTestId("members")).not.toContainText("Céline");

  await openWeek(page);
  await expect(page.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toContainText("Rien de prévu");
});

test("the household screen holds up on a phone", async ({ request, context, page }) => {
  const { host } = await share(request);
  await signIn(context, host);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/fr/app/foyer");
  await expect(page.getByTestId("members")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

/**
 * A household of two, with one dish on Wednesday. Set up through the API
 * rather than the screen, so each test is about the one thing it asserts.
 */
async function share(request: APIRequestContext) {
  const host = await register(request, "host");
  const guest = await register(request, "guest");
  await subscribeToFamily(request, host);

  const curry = await seedRecipe(request, host, "Curry du foyer");
  await planMeal(request, host, WEDNESDAY, "DINNER", curry);
  // The guest has a library of their own, which is what makes "their own plan
  // is empty" mean an empty week rather than an empty account.
  await seedRecipe(request, guest, "Salade de Camille");

  await request.post(`${BACKEND}/api/household/invitations`, {
    headers: { Authorization: `Bearer ${host.token}` },
    data: { email: guest.email, locale: "fr" },
  });
  const link = await invitationLinkFor(request, guest.email);
  const token = link.searchParams.get("token")!;
  const joined = await request.post(`${BACKEND}/api/household/join`, {
    headers: { Authorization: `Bearer ${guest.token}` },
    data: { token },
  });
  expect(joined.status()).toBe(200);

  return { host, guest };
}
