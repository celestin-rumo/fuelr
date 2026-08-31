import { test, expect } from "@playwright/test";

test("design system page renders every section", async ({ page }) => {
  await page.goto("/fr/design-system");

  await expect(
    page.getByRole("heading", { name: "Colour ramps — 100 to 1000" }),
  ).toBeVisible();

  // The token table is the contract the whole system rests on.
  await expect(page.getByRole("cell", { name: "--bg-raised-2" })).toBeVisible();

  // One live control per family, to prove the page is interactive.
  const chip = page.getByRole("button", { name: "Sans gluten" });
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("theme toggle swaps the token values", async ({ page }) => {
  await page.goto("/fr/design-system");

  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  const darkBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
  );
  expect(darkBg).toBe("#121212");

  await page.getByRole("button", { name: "Changer de thème" }).click();

  await expect(html).toHaveClass(/light/);
  const lightBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
  );
  expect(lightBg).toBe("#f7f5ef");
});
