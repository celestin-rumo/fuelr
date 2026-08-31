import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `cook-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  const { token } = await response.json();
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("the draft exists from the first click, with no form first", async ({ page }) => {
  await page.goto("/fr/app");
  await page.getByRole("link", { name: "Nouvelle recette" }).first().click();

  // Straight into the editor of a recipe that already has an id — no
  // "name your recipe" step in between.
  await expect(page).toHaveURL(/\/fr\/app\/recettes\/\d+$/);
  await expect(page.getByTestId("draft-status")).toContainText("Brouillon");
});

test("a draft survives a full reload without any save prompt", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");
  const url = page.url();

  await page.getByLabel("Titre").fill("Curry de lentilles corail");
  await expect(page.getByTestId("draft-status")).toContainText(
    "enregistré en continu",
  );

  // Leaving must not raise a dialog. Fail loudly if one appears.
  page.on("dialog", (dialog) => {
    throw new Error(`unexpected dialog: ${dialog.message()}`);
  });
  await page.goto("/fr/app");
  await page.goto(url);

  await expect(page.getByLabel("Titre")).toHaveValue("Curry de lentilles corail");
});

test("saving is refused without an ingredient, and points at the tab", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await page.getByLabel("Titre").fill("Curry");
  await page.getByRole("button", { name: "Étapes" }).click();
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.getByLabel("Étape 1", { exact: true }).fill("Cuire 15 min.");

  await page.getByRole("button", { name: "Enregistrer la recette" }).click();

  await expect(page.getByTestId("recipe-error")).toContainText(
    "Ajoute au moins un ingrédient.",
  );
  await expect(page.getByRole("button", { name: /Ingrédients/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
});

test("saving is refused without a step", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await page.getByLabel("Titre").fill("Curry");
  await page.getByRole("button", { name: /Ingrédients/ }).click();
  await page.getByLabel("Ingrédient").fill("Lentilles corail");
  await page.getByLabel("Quantité").fill("300");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  await page.getByRole("button", { name: "Enregistrer la recette" }).click();

  await expect(page.getByTestId("recipe-error")).toContainText(
    "Ajoute au moins une étape.",
  );
});

test("a complete recipe saves and appears in the list", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await page.getByLabel("Titre").fill("Curry de lentilles corail");

  await page.getByRole("button", { name: /Ingrédients/ }).click();
  await page.getByLabel("Ingrédient").fill("Lentilles corail");
  await page.getByLabel("Quantité").fill("300");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  // Enter chains straight into the next ingredient without touching the mouse.
  await page.getByLabel("Ingrédient").fill("Lait de coco");
  await page.getByLabel("Quantité").fill("400");
  await page.getByLabel("Quantité").press("Enter");
  await expect(page.getByText("Lait de coco")).toBeVisible();

  await page.getByRole("button", { name: "Étapes" }).click();
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.getByLabel("Étape 1", { exact: true }).fill("Cuire 15 min à couvert.");

  await page.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(page.getByTestId("draft-status")).toContainText("Enregistrée");

  await page.goto("/fr/app");
  await expect(
    page.getByRole("heading", { name: "Curry de lentilles corail" }),
  ).toBeVisible();
});

test("an ingredient can be removed", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: /Ingrédients/ }).click();

  await page.getByLabel("Ingrédient").fill("Oignon");
  await page.getByLabel("Quantité").fill("2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Oignon")).toBeVisible();

  await page.getByRole("button", { name: "Retirer Oignon" }).click();
  await expect(page.getByText("Aucun ingrédient pour l'instant.")).toBeVisible();
});

test("the unit of an ingredient is kept", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: /Ingrédients/ }).click();

  await page.getByLabel("Ingrédient").fill("Lait de coco");
  await page.getByLabel("Quantité").fill("400");
  await page.getByLabel("Unité").selectOption("ml");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  await expect(page.getByText("400 ml")).toBeVisible();

  // And it survives the round trip through the backend.
  await page.waitForTimeout(1200);
  await page.reload();
  await page.getByRole("button", { name: /Ingrédients/ }).click();
  await expect(page.getByText("400 ml")).toBeVisible();
});
