import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function register(request: APIRequestContext, email: string) {
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Camille", password: "motdepasse123" },
  });
  if (!response.ok() && response.status() !== 409) {
    throw new Error(`register failed: ${response.status()}`);
  }
  const login = await request.post(`${BACKEND}/api/auth/login`, {
    data: { email, password: "motdepasse123" },
  });
  return (await login.json()).token as string;
}

test.describe("/app is closed without a valid session", () => {
  test("an anonymous visitor is sent to the localised login page", async ({ page }) => {
    await page.goto("/fr/app");

    await expect(page).toHaveURL(/\/fr\/connexion\?next=%2Ffr%2Fapp$/);
  });

  test("the destination survives the redirect", async ({ page }) => {
    await page.goto("/fr/app/recettes/nouvelle?jour=mardi");

    // Whatever they asked for comes back in `next`, query string included.
    const marker = page.getByTestId("login-next");
    await expect(marker).toHaveAttribute(
      "data-next",
      "/fr/app/recettes/nouvelle?jour=mardi",
    );
  });

  test("each locale redirects to its own login slug", async ({ page }) => {
    await page.goto("/en/app");
    await expect(page).toHaveURL(/\/en\/login\?next=/);

    await page.goto("/de/app");
    await expect(page).toHaveURL(/\/de\/anmelden\?next=/);
  });

  test("a forged cookie does not get past the server check", async ({ page, context }) => {
    // This is the case the middleware cannot catch: a cookie is present, so
    // the cheap gate lets it through, and only the backend can reject it.
    await context.addCookies([
      {
        name: "fuelr_token",
        value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged-signature",
        url: "http://localhost:3000",
      },
    ]);

    await page.goto("/fr/app");

    await expect(page).toHaveURL(/\/fr\/connexion/);
  });
});

test.describe("/app opens with a real session", () => {
  test("a signed-in visitor reaches the product", async ({ page, context, request }) => {
    const token = await register(request, `guard-${Date.now()}@fuelr.app`);
    await context.addCookies([
      { name: "fuelr_token", value: token, url: "http://localhost:3000" },
    ]);

    await page.goto("/fr/app");

    await expect(page).toHaveURL(/\/fr\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour");
  });

  test("the login page bounces an already signed-in visitor to /app", async ({
    page,
    context,
    request,
  }) => {
    const token = await register(request, `bounce-${Date.now()}@fuelr.app`);
    await context.addCookies([
      { name: "fuelr_token", value: token, url: "http://localhost:3000" },
    ]);

    await page.goto("/fr/connexion");

    await expect(page).toHaveURL(/\/fr\/app$/);
  });
});
