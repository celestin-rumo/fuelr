import { test, expect } from "@playwright/test";

test("home page renders the Fuelr heading", async ({ page }) => {
  await page.goto("/");

  // The next-intl proxy negotiates the locale from Accept-Language, which
  // playwright.config.ts pins to fr-FR.
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fuelr");
});
