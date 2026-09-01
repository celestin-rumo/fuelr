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

test("the stepper says what is still missing, with no button to be refused by", async ({
  page,
}) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await expect(page.getByTestId("missing-hint")).toContainText("un titre");
  await expect(page.getByTestId("missing-hint")).toContainText("un ingrédient");
  await expect(page.getByTestId("missing-hint")).toContainText("une étape");

  await page.getByLabel("Titre").fill("Curry");
  await expect(page.getByTestId("missing-hint")).not.toContainText("un titre");

  // There is no save button at all — the editor autosaves.
  await expect(
    page.getByRole("button", { name: "Enregistrer la recette" }),
  ).toHaveCount(0);
});

test("a recipe becomes complete on its own once the content is there", async ({
  page,
  request,
}) => {
  await page.goto("/fr/app/recettes/nouvelle");
  const url = page.url();

  await page.getByLabel("Titre").fill("Curry de lentilles corail");

  await page.getByRole("button", { name: /Ingrédients/ }).click();
  await page.getByLabel("Ingrédient").fill("Lentilles corail");
  await page.getByLabel("Quantité").fill("300");
  await page.getByLabel("Quantité").press("Enter");

  await page.getByRole("button", { name: "Étapes" }).click();
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.getByLabel("Étape 1", { exact: true }).fill("Cuire 15 min à couvert.");

  await expect(page.getByTestId("missing-hint")).toHaveCount(0);

  // Status is derived from the content, so it lands with no action taken.
  const id = url.split("/").pop();
  await expect
    .poll(async () => {
      const response = await request.get(`${BACKEND}/api/recipes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await response.json()).status;
    }, { timeout: 10_000 })
    .toBe("PUBLISHED");

  await page.goto("/fr/app");
  await expect(
    page.getByRole("heading", { name: "Curry de lentilles corail" }),
  ).toBeVisible();
});

test("the back control returns to the library and is not a delete", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  const back = page.getByRole("link", { name: "Revenir à mes recettes" });
  await expect(back).toBeVisible();
  await back.click();

  await expect(page).toHaveURL(/\/fr\/app$/);
});

test("the editor holds up on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/fr/app/recettes/nouvelle");

  // Nothing may push the body sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The stepper stays usable: every marker reachable, current label readable.
  for (const label of ["Base", "Ingrédients", "Étapes"]) {
    await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }
  await page.getByRole("button", { name: /Étapes/ }).click();
  await expect(page.getByRole("button", { name: "Ajouter une étape" })).toBeVisible();
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

test("editing an already-usable recipe warns about what changes", async ({
  page,
  request,
}) => {
  // A fresh draft has never been used, so it says nothing.
  await page.goto("/fr/app/recettes/nouvelle");
  await expect(page.getByTestId("already-used-notice")).toHaveCount(0);

  // A complete recipe, reopened, does.
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Curry",
      servings: 4,
      ingredients: [{ name: "riz", quantity: 100, unit: "g" }],
      steps: ["Cuire."],
    },
  });

  await page.goto(`/fr/app/recettes/${id}`);
  await expect(page.getByTestId("already-used-notice")).toContainText(
    "prochaines utilisations",
  );
  await expect(page.getByTestId("already-used-notice")).toContainText(
    "déjà journalisés",
  );
});

test("an already-complete recipe reads as saved on open", async ({ page, request }) => {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Curry",
      servings: 4,
      ingredients: [{ name: "riz", quantity: 100, unit: "g" }],
      steps: ["Cuire."],
    },
  });

  await page.goto(`/fr/app/recettes/${id}`);

  // It must not say "Brouillon" while the notice below says it is usable.
  await expect(page.getByTestId("draft-status")).toHaveText("Enregistré");
});

test("each panel offers a way forward, and the last one closes", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  // Nothing to go back to on the first panel.
  await expect(page.getByRole("button", { name: /Précédent/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Suivant/ }).click();
  await expect(page.getByRole("button", { name: /Ingrédients/ })).toHaveAttribute(
    "aria-current",
    "step",
  );

  await page.getByRole("button", { name: /Précédent/ }).click();
  await expect(page.getByRole("button", { name: /Base/ })).toHaveAttribute(
    "aria-current",
    "step",
  );

  await page.getByRole("button", { name: /Suivant/ }).click();
  await page.getByRole("button", { name: /Suivant/ }).click();

  // Last panel: no "next", just a way out.
  await expect(page.getByRole("button", { name: /Suivant/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Fermer" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/);
});

test("quantity and unit share one line on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/fr/app/recettes/nouvelle");
  await page.getByRole("button", { name: /Ingrédients/ }).click();

  const quantity = await page.getByLabel("Quantité").boundingBox();
  const unit = await page.getByLabel("Unité").boundingBox();

  // Same row: their vertical centres line up.
  const quantityCentre = quantity!.y + quantity!.height / 2;
  const unitCentre = unit!.y + unit!.height / 2;
  expect(Math.abs(quantityCentre - unitCentre)).toBeLessThan(8);

  // And side by side, not overlapping.
  expect(quantity!.x + quantity!.width).toBeLessThanOrEqual(unit!.x + 1);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
