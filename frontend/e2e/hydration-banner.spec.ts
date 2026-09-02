import { test, expect } from "@playwright/test";

const banner = '[data-testid="hydration-banner"]';

test("a healthy page never shows the banner", async ({ page }) => {
  await page.goto("/fr/connexion");
  // Long past the reveal delay: it is not hidden, it is not there at all.
  await page.waitForTimeout(5000);
  await expect(page.locator(banner)).toHaveCount(0);
  await expect(page.getByLabel("Email")).toBeEditable();
});

test("a page whose scripts never load says so instead of failing silently", async ({
  page,
}) => {
  // Exactly the situation that looked like "clicking sign in does nothing":
  // the markup arrives, React never hydrates, every control is inert.
  await page.route("**/_next/static/chunks/**.js", (route) => route.abort());
  await page.goto("/fr/connexion").catch(() => {});

  const opacity = () =>
    page.evaluate(
      (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).opacity : null;
      },
      banner,
    );

  // Held back at first, so a page that hydrates a moment late never flashes it.
  expect(await opacity()).toBe("0");

  await expect
    .poll(opacity, { timeout: 10000, message: "the banner never revealed itself" })
    .toBe("1");

  await expect(page.locator(banner)).toContainText("ne répond pas");

  // The way out is a link, not a button: nothing is listening for a click.
  const reload = page.locator(banner).getByRole("link");
  await expect(reload).toHaveText("Recharger la page");
});
