import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `poids-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([{ name: "fuelr_token", value: token, url: "http://localhost:3000" }]);
  await request.put(`${BACKEND}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { age: 34, sex: "FEMALE", heightCm: 168, weightKg: 62, activity: "MODERATE", goal: "MAINTAIN" },
  });
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("a weigh-in is a figure and a date, drawn and never judged", async ({ page }) => {
  await page.goto("/fr/app/journal");
  const panel = page.getByTestId("weight-panel");
  await expect(panel.getByTestId("weight-empty")).toBeVisible();

  await panel.getByTestId("weight-kg").fill("61.8");
  await panel.getByTestId("weight-submit").click();

  await expect(panel.getByTestId("weight-latest")).toContainText("61.8 kg");
  await expect(panel.getByTestId("weight-curve")).toBeVisible();
  await expect(panel).toContainText(/aucune conclusion/);
  await expect(panel).not.toContainText(/bravo|série/i);
});

test("a weigh-in proposes a new target and never applies one", async ({ request, page }) => {
  await page.goto("/fr/app/journal");
  const panel = page.getByTestId("weight-panel");

  // Four kilos away from what the target is computed from.
  await panel.getByTestId("weight-kg").fill("58");
  await panel.getByTestId("weight-submit").click();
  await expect(panel.getByTestId("weight-recompute")).toBeVisible();

  // Nothing moved on its own.
  let profile = await (await request.get(`${BACKEND}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  expect(profile.profile.weightKg).toBe(62);

  await panel.getByTestId("weight-recompute").getByRole("button").click();
  await expect(panel.getByTestId("weight-recompute")).toHaveCount(0);

  profile = await (await request.get(`${BACKEND}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  expect(profile.profile.weightKg).toBe(58);
});

test("removing a weigh-in asks nothing and can be undone", async ({ page }) => {
  await page.goto("/fr/app/journal");
  const panel = page.getByTestId("weight-panel");
  await panel.getByTestId("weight-kg").fill("62.4");
  await panel.getByTestId("weight-submit").click();
  await expect(panel.getByTestId("weight-latest")).toContainText("62.4");

  await panel.getByRole("button", { name: /Retirer la pesée/ }).click();
  await expect(panel.getByTestId("weight-removed")).toBeVisible();
  await expect(panel.getByTestId("weight-empty")).toBeVisible();

  await panel.getByTestId("weight-undo").click();
  await expect(panel.getByTestId("weight-latest")).toContainText("62.4");
});
