import { test, expect } from "@playwright/test";

test("the root redirects to the negotiated locale", async ({ page }) => {
  await page.goto("/");

  // The next-intl proxy negotiates the locale from Accept-Language, which
  // playwright.config.ts pins to fr-FR.
  await expect(page).toHaveURL(/\/fr$/);
  await expect(
    page.getByRole("heading", { name: "Planifie tes repas, atteins tes objectifs." }),
  ).toBeVisible();
});
