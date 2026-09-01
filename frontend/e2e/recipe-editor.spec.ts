import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

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

/** Reads the stored recipe, so persistence is asserted rather than inferred. */
async function storedSteps(request: APIRequestContext, url: string) {
  const id = url.split("/").pop();
  const response = await request.get(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await response.json()).steps as string[];
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
  // Status now reads as terse text beside the title rather than a sentence.
  await expect(page.getByTestId("draft-status")).toHaveText("Enregistré");

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
  await expect(page.getByTestId("draft-status")).toHaveText("Enregistré");

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

test("steps can be reordered and reordering survives a reload", async ({ page, request }) => {
  await page.goto("/fr/app/recettes/nouvelle");
  const url = page.url();
  await page.getByRole("button", { name: "Étapes" }).click();

  for (const [index, text] of ["Émincer.", "Cuire.", "Servir."].entries()) {
    await page.getByRole("button", { name: "Ajouter une étape" }).click();
    await page.getByLabel(`Étape ${index + 1}`, { exact: true }).fill(text);
  }

  // Move "Servir." from last to second.
  await page.getByRole("button", { name: "Monter l'étape 3" }).click();
  await expect(page.getByLabel("Étape 2", { exact: true })).toHaveValue("Servir.");
  await expect(page.getByLabel("Étape 3", { exact: true })).toHaveValue("Cuire.");

  await expect
    .poll(() => storedSteps(request, url), { timeout: 10_000 })
    .toEqual(["Émincer.", "Servir.", "Cuire."]);

  await page.reload();
  await page.getByRole("button", { name: "Étapes" }).click();
  await expect(page.getByLabel("Étape 2", { exact: true })).toHaveValue("Servir.");
});

test("the ends of the list cannot be moved past", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: "Étapes" }).click();
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.getByLabel("Étape 1", { exact: true }).fill("Seule étape.");

  await expect(page.getByRole("button", { name: "Monter l'étape 1" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Descendre l'étape 1" })).toBeDisabled();
});

test("a blank step is never stored", async ({ page, request }) => {
  await page.goto("/fr/app/recettes/nouvelle");
  const url = page.url();
  await page.getByRole("button", { name: "Étapes" }).click();

  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.getByLabel("Étape 1", { exact: true }).fill("Cuire 15 min.");
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  // Second row left empty on purpose.

  // Poll the stored recipe instead of sleeping past the autosave debounce.
  await expect
    .poll(() => storedSteps(request, url), { timeout: 10_000 })
    .toEqual(["Cuire 15 min."]);

  await page.reload();
  await page.getByRole("button", { name: "Étapes" }).click();
  await expect(page.getByLabel("Étape 1", { exact: true })).toHaveValue("Cuire 15 min.");
  await expect(page.getByLabel("Étape 2", { exact: true })).toHaveCount(0);
});
