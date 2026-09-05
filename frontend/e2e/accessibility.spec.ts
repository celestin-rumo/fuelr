import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result, NodeResult } from "axe-core";

/**
 * Usable without a mouse, and usable read aloud.
 *
 * The intentions were already right — every control carries a focus ring, the
 * icons are `aria-hidden` with the name on the control, the dialog traps
 * focus. What was missing is the thing that makes any of it stay true: nothing
 * measured it. This is to the keyboard what `mobile-360.spec.ts` is to a
 * narrow screen.
 *
 * Two kinds of check, and they catch different failures.
 *
 * **axe** reads the rendered accessibility tree against WCAG 2.1 A and AA. It
 * is very good at the things a person cannot see: a control with no name, a
 * heading level skipped, a contrast ratio below the floor, a form field with
 * no label. It is scoped to `wcag2a`/`wcag2aa` rather than every rule axe
 * knows, because "best practice" findings are opinions and a suite that fails
 * on an opinion gets disabled.
 *
 * **The journeys** are what axe cannot see: whether Tab actually reaches the
 * button, whether Escape closes the menu, whether focus comes back somewhere
 * sensible afterwards. A page can pass every rule and still be impossible to
 * operate.
 */
const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `a11y-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function seed(request: APIRequestContext, title: string) {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      servings: 4,
      ingredients: [{ name: "Lentilles corail", quantity: 200, unit: "g" }],
      steps: ["Rincer les lentilles.", "Cuire 20 min."],
    },
  });
  return id as number;
}

/**
 * Every WCAG A/AA violation on the page, as lines somebody can act on.
 *
 * The failure message names the rule, how many nodes broke it and the first
 * offender's markup — "3 violations" tells whoever reads the CI log nothing at
 * all, and this is a test that will mostly be read by someone who did not
 * write it.
 */
async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return results.violations.map(
    (violation: Result) =>
      `${violation.id} (${violation.impact}) — ${violation.help}\n` +
      violation.nodes
        .slice(0, 3)
        .map((node: NodeResult) => `    ${node.target.join(" ")}\n      ${node.html.slice(0, 160)}`)
        .join("\n"),
  );
}

async function clean(page: Page, what: string) {
  const found = await violations(page);
  expect(found, `${what}\n\n${found.join("\n\n")}`).toEqual([]);
}

// --- the public site, which anybody can reach ----------------------------

const PUBLIC = [
  ["the home page", "/fr"],
  ["the features page", "/fr/fonctionnalites"],
  ["the pricing page", "/fr/tarifs"],
  ["the about page", "/fr/a-propos"],
  ["the contact page", "/fr/contact"],
  ["the privacy page", "/fr/confidentialite"],
  ["the sign-in page", "/fr/connexion"],
  ["the sign-up page", "/fr/inscription"],
] as const;

for (const [what, path] of PUBLIC) {
  test(`${what} has no WCAG A/AA violation`, async ({ page }) => {
    await page.goto(path);
    await clean(page, `${what} (${path})`);
  });
}

// --- the application, which is where the work happens ---------------------

test.describe("signed in", () => {
  test.beforeEach(async ({ request, context }) => {
    await signIn(request, context);
  });

  test("the library has no WCAG A/AA violation", async ({ request, page }) => {
    await seed(request, "Curry de lentilles corail");
    await page.goto("/fr/app");
    await clean(page, "the library");
  });

  test("the planner, the shopping list and the journal have none", async ({
    request,
    page,
  }) => {
    await seed(request, "Curry de lentilles corail");
    for (const path of ["/fr/app/planning", "/fr/app/courses", "/fr/app/journal"]) {
      await page.goto(path);
      await clean(page, path);
    }
  });

  test("the editor and cooking mode have none", async ({ request, page }) => {
    const recipe = await seed(request, "Curry de lentilles corail");
    await page.goto(`/fr/app/recettes/${recipe}`);
    await clean(page, "the recipe editor");

    await page.goto(`/fr/app/recettes/${recipe}/cuisiner`);
    await expect(page.getByTestId("cook-progress")).toBeVisible();
    await clean(page, "cooking mode");
  });

  test("the household screen and the idea screen have none", async ({ page }) => {
    for (const path of ["/fr/app/foyer", "/fr/app/idees"]) {
      await page.goto(path);
      await clean(page, path);
    }
  });

  // --- what axe cannot see -----------------------------------------------

  test("a recipe can be reached and opened with the keyboard alone", async ({
    request,
    page,
  }) => {
    await seed(request, "Curry de lentilles corail");
    await page.goto("/fr/app");

    // Tab until the recipe's own link has focus. The cap is a bound on the
    // failure, not an expectation: if the row is unreachable this stops
    // rather than hanging for thirty seconds.
    // Exact: "Cuisiner Curry de lentilles corail" is a link on the same row,
    // and a substring match would resolve to both.
    const link = page.getByRole("link", {
      name: "Curry de lentilles corail",
      exact: true,
    });
    let reached = false;
    for (let press = 0; press < 40 && !reached; press++) {
      await page.keyboard.press("Tab");
      reached = await link.evaluate((node) => node === document.activeElement);
    }
    expect(reached, "the recipe's link is not reachable by Tab").toBe(true);

    // And focus is *visible* while it is there. `outline-width` rather than a
    // class name: which of two competing focus utilities wins is decided by
    // the stylesheet's order, so the class list proves nothing.
    const outline = await link.evaluate(
      (node) => getComputedStyle(node).outlineWidth,
    );
    expect(parseFloat(outline), "the focused link draws no outline").toBeGreaterThan(0);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/fr\/app\/recettes\/\d+$/);
  });

  test("the row's menu opens, walks and closes from the keyboard", async ({
    request,
    page,
  }) => {
    await seed(request, "Curry");
    await page.goto("/fr/app");

    const trigger = page.getByRole("button", { name: "Autres actions pour Curry" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu", { name: "Autres actions pour Curry" });
    await expect(menu).toBeVisible();

    // Tab moves into the menu's items rather than past the whole thing.
    await page.keyboard.press("Tab");
    await expect(menu.getByRole("menuitem").first()).toBeFocused();

    // Escape closes it and hands focus back: dropping focus on the body sends
    // a keyboard user to the top of the page.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a dialog can be closed with Escape, and gives focus back", async ({
    request,
    page,
  }) => {
    await seed(request, "Curry");
    await page.goto("/fr/app");

    await page.getByRole("button", { name: "Planifier Curry" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Focus starts inside the dialog rather than behind it.
    const inside = await page.evaluate(() => {
      const open = document.querySelector('[role="dialog"]');
      return open?.contains(document.activeElement) ?? false;
    });
    expect(inside, "focus stayed outside the dialog that just opened").toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("cooking mode is operable without a pointer", async ({ request, page }) => {
    // The one screen most likely to be driven by something other than a
    // finger: the hands are busy.
    const recipe = await seed(request, "Curry de lentilles corail");
    await page.goto(`/fr/app/recettes/${recipe}/cuisiner`);
    // Waited for, not assumed: the session is restored on the client, so the
    // footer re-renders once and focus taken before that is dropped.
    await expect(page.getByTestId("cook-progress")).toBeVisible();

    const next = page.getByRole("button", { name: /Suivante/ });
    await expect(next).toBeEnabled();
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("cook-progress")).toContainText("2");
  });
});

// --- the skip link, which only a keyboard ever sees -----------------------

test("the first Tab offers a way past the navigation", async ({ page }) => {
  // Without it, reaching the content of any page costs a dozen presses
  // through the same header, on every page, forever.
  await page.goto("/fr");
  await page.keyboard.press("Tab");

  const skip = page.getByTestId("skip-link");
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);

  const focused = await page.evaluate(() => document.activeElement?.id);
  expect(focused).toBe("contenu");
});
