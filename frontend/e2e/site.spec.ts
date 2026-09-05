import { test, expect } from "@playwright/test";

// The French slugs are the contract: /fonctionnalites must never surface as
// /features on the French site.
const PAGES = [
  { path: "/fr", heading: "Planifie tes repas, atteins tes objectifs." },
  { path: "/fr/fonctionnalites", heading: "Tout ce qu'il faut, rien de décoratif" },
  { path: "/fr/tarifs", heading: "Un prix, pas un labyrinthe" },
  { path: "/fr/a-propos", heading: "On voulait juste savoir quoi manger mardi soir" },
  { path: "/fr/contact", heading: "Écris-nous, on répond vraiment" },
];

for (const page_ of PAGES) {
  test(`${page_.path} renders its heading`, async ({ page }) => {
    await page.goto(page_.path);
    await expect(
      page.getByRole("heading", { name: page_.heading }),
    ).toBeVisible();
  });
}

test("the header navigates between the marketing pages", async ({ page }) => {
  await page.goto("/fr");

  // The same labels exist in the footer, so scope to the header landmark.
  const header = page.getByRole("banner");

  await header.getByRole("link", { name: "Tarifs", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/tarifs$/);

  await header.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/contact$/);
});

test("each locale gets its own slug", async ({ page }) => {
  await page.goto("/en/features");
  await expect(page).toHaveURL(/\/en\/features$/);

  await page.goto("/de/preise");
  await expect(page).toHaveURL(/\/de\/preise$/);
});

test("the pricing toggle swaps monthly for yearly prices", async ({ page }) => {
  await page.goto("/fr/tarifs");

  await expect(page.getByText("6,90")).toBeVisible();
  await page.getByRole("button", { name: /Annuel/ }).click();

  await expect(page.getByText("69", { exact: true })).toBeVisible();
  await expect(page.getByText("6,90")).toHaveCount(0);
});

test("the contact form refuses an incomplete message", async ({ page }) => {
  await page.goto("/fr/contact");

  // The page is prerendered, so the submit button exists before React has
  // hydrated and an early click is swallowed. Toggling a chip only succeeds
  // once the handlers are live, which makes it a real hydration signal —
  // asserting on prerendered markup would not be.
  const subject = page.getByRole("button", { name: "Un bug" });
  await expect(async () => {
    await subject.click();
    await expect(subject).toHaveAttribute("aria-pressed", "true", {
      timeout: 500,
    });
  }).toPass();

  await page.getByRole("button", { name: "Envoyer le message" }).click();

  // Scoped to the form on purpose: Next.js keeps its own route announcer in
  // the DOM with role="alert", so a page-wide query always matches two nodes.
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Indique ton nom.",
  );
});

test("no marketing page scrolls sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });

  // The header is shared, so one page passing proves little and one page
  // failing breaks the whole public site — as the "try it free" button did,
  // staying visible at 375px because the Button's own `inline-flex` beat the
  // `hidden` passed to it.
  for (const path of ["/fr", "/fr/fonctionnalites", "/fr/tarifs", "/fr/a-propos", "/fr/contact"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} déborde`).toBeLessThanOrEqual(0);
  }
});

test("the phone menu reaches every page the wide nav does", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/fr");

  await page.getByRole("button", { name: "Menu" }).click();
  // Scoped to the header: the footer carries the same links, so a page-wide
  // query is a strict-mode violation rather than a finding.
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Tarifs" })
    .click();
  await expect(page).toHaveURL(/\/fr\/tarifs$/);
});

test("every call to action on the public site actually goes somewhere", async ({
  page,
}) => {
  // A <Button> with no handler renders perfectly and does nothing. Five of
  // them shipped that way, including the home page's main "start — it's free".
  // Asserting the destination is the only thing that catches it.
  const CTAS = [
    { path: "/fr", name: "Commencer — c'est gratuit", lands: /\/fr\/commencer$/ },
    { path: "/fr", name: "Voir les fonctionnalités", lands: /\/fr\/fonctionnalites$/ },
    { path: "/fr", name: "Créer mon compte", lands: /\/fr\/inscription$/ },
    { path: "/fr/tarifs", name: "Commencer", lands: /\/fr\/inscription$/ },
    { path: "/fr/tarifs", name: "Essayer 14 jours", lands: /\/fr\/inscription$/ },
    { path: "/fr/tarifs", name: "Choisir Famille", lands: /\/fr\/inscription$/ },
  ];

  for (const cta of CTAS) {
    await page.goto(cta.path);
    await page
      .getByRole("link", { name: cta.name, exact: true })
      .first()
      .click();
    await expect(page, `« ${cta.name} » ne mène nulle part`).toHaveURL(cta.lands);
  }
});

test("the header's try-it button leads to the onboarding", async ({ page }) => {
  await page.goto("/fr");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Essayer gratuitement" })
    .click();
  await expect(page).toHaveURL(/\/fr\/commencer$/);
});

test("the footer leads to the data page, which says where the AI runs", async ({
  page,
}) => {
  await page.goto("/fr");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Confidentialité" })
    .click();

  await expect(page).toHaveURL(/\/fr\/confidentialite$/);
  // The reason the page exists: an AI feature sends what it is given out of
  // the country, and somebody deciding whether to use one should read that
  // before, not after.
  await expect(page.getByRole("main")).toContainText("Anthropic");
  await expect(page.getByRole("main")).toContainText("quitte donc la Suisse");
});

test("the data page holds up on a 360px phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/fr/confidentialite");

  await expect(
    page.getByRole("heading", { name: "Où vont tes données" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the public site is in the visitor's language, not French with a flag", async ({
  page,
}) => {
  // `site.json` was French in all three locales: an English visitor read
  // French on the front page. This is the criterion, and it is asserted on
  // the copy rather than on the slug — a translated URL over French words is
  // the failure this replaces.
  await page.goto("/en");
  await expect(
    page.getByRole("heading", { name: "Plan your meals, reach your targets." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Pricing" }).first()).toBeVisible();
  await expect(page.getByText("Planifie tes repas")).toHaveCount(0);

  await page.goto("/de");
  await expect(
    page.getByRole("heading", { name: "Plane deine Mahlzeiten, erreich deine Ziele." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Preise" }).first()).toBeVisible();
  await expect(page.getByText("Planifie tes repas")).toHaveCount(0);
});

test("the German is Swiss German", async ({ page }) => {
  // No eszett, and the guillemets Switzerland uses rather than the German
  // low-9 pair. Cheap to assert, and the kind of thing that drifts back one
  // string at a time.
  await page.goto("/de");
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("ß");
  expect(text).not.toContain("„");
});

test("the price is in francs everywhere, including the figure that is zero", async ({
  page,
}) => {
  // The stats band said "0 €" on a product billed in CHF.
  for (const path of ["/fr", "/en", "/de"]) {
    await page.goto(path);
    await expect(page.getByText("0 CHF")).toBeVisible();
    await expect(page.getByText("0 €")).toHaveCount(0);
  }
});
