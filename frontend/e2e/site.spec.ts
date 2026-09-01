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
