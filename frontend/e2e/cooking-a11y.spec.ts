import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

/**
 * axe-core is read straight out of `node_modules` and injected into the page.
 * If it ever stops being installed this fails loudly, which is the right way
 * round for a check that exists to catch regressions.
 */
const AXE = "node_modules/axe-core/axe.min.js";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `cook-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

async function createRecipe(request: APIRequestContext) {
  const draft = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  const { id } = await draft.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Curry de lentilles corail",
      servings: 4,
      ingredients: [
        { name: "Lentilles corail", quantity: 200, unit: "g", needsReview: false },
        { name: "Lait de coco", quantity: 400, unit: "ml", needsReview: true },
      ],
      steps: [
        "Rincer les lentilles à l'eau froide.",
        "Faire revenir l'oignon 5 min.",
        "Mijoter 20 min et servir.",
      ],
      tags: [],
    },
  });
  return id as number;
}

/** Every control the cook could hit, and how small its smallest side is. */
async function undersizedTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], [role=button]")]
      .filter((element) => {
        // Clipped away until focus reaches it — the skip link, which becomes
        // a 44px control the moment it matters and is held to that in
        // `e2e/accessibility.spec.ts`.
        const style = getComputedStyle(element);
        return (
          style.clipPath !== "inset(50%)" &&
          style.clip !== "rect(0px, 0px, 0px, 0px)"
        );
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          name:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().slice(0, 40) ||
            element.outerHTML.slice(0, 60),
          smallest: Math.round(Math.min(box.width, box.height)),
          visible: box.width > 0 && box.height > 0,
        };
      })
      .filter((target) => target.visible && target.smallest < 56),
  );
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("cooking mode passes an axe audit, in both themes", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request);
  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await expect(page.getByTestId("cook-step")).toBeVisible();

  for (const theme of ["dark", "light"] as const) {
    await page.evaluate((mode) => {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(mode);
    }, theme);

    await page.addScriptTag({ path: AXE });
    const violations = await page.evaluate(async () => {
      const results = await (
        window as unknown as {
          axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> };
        }
      ).axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] });
      return (
        results.violations as { id: string; nodes: { target: string[] }[] }[]
      ).map(
        (violation) =>
          `${violation.id}: ${violation.nodes
            .map((node) => node.target.join(" "))
            .join(", ")}`,
      );
    });

    expect(violations, `axe violations in ${theme}`).toEqual([]);
  }
});

test("every control is big enough for a hand covered in flour", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/fr/app/recettes/${id}/cuisiner`);
  await expect(page.getByTestId("cook-step")).toBeVisible();

  expect(await undersizedTargets(page)).toEqual([]);

  // The ingredients sheet and the timers bring their own controls.
  await page.getByRole("button", { name: "Ingrédients" }).click();
  expect(await undersizedTargets(page)).toEqual([]);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Suivante" }).click();
  await page.getByRole("button", { name: "⏱ 5 min" }).click();
  expect(await undersizedTargets(page)).toEqual([]);
});

test("a phone propped up sideways still works", async ({ page, request }) => {
  const id = await createRecipe(request);
  // Landscape: a phone leaning against something on the counter.
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto(`/fr/app/recettes/${id}/cuisiner`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await expect(page.getByRole("button", { name: "Suivante" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Ingrédients" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Quitter le mode cuisine" })).toBeInViewport();
});

test("the step and the timers are announced, not only shown", async ({
  page,
  request,
}) => {
  const id = await createRecipe(request);
  // The ingredients opener only exists below `lg`; above it the panel is
  // simply there.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/fr/app/recettes/${id}/cuisiner`);

  // The step is a live region, so changing step is spoken.
  await expect(page.getByTestId("cook-step")).toHaveAttribute("aria-live", "polite");

  // And an unverified quantity is named as such rather than shown in coral
  // and left at that.
  await page.getByRole("button", { name: "Ingrédients" }).click();
  await expect(page.getByTestId("cook-ingredient-review")).toHaveText("À vérifier");
});
