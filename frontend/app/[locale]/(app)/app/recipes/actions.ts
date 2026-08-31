"use server";

import { apiFetch } from "@app/lib/api";

export type IngredientDraft = { name: string; quantity: number; unit: string };

export type RecipeDraft = {
  title: string;
  description: string;
  servings: number;
  level: string | null;
  ingredients: IngredientDraft[];
  steps: string[];
  tags: string[];
};

/** Autosave. Accepts a half-finished recipe — that is the point of a draft. */
export async function saveRecipe(id: number, draft: RecipeDraft) {
  const response = await apiFetch(`/api/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }
  return { ok: true as const };
}

export type PublishResult =
  | { ok: true }
  | { ok: false; errors: { field: string; message: string }[] };

/** The only gate: the backend decides whether the recipe is complete. */
export async function publishRecipe(
  id: number,
  draft: RecipeDraft,
): Promise<PublishResult> {
  const saved = await saveRecipe(id, draft);
  if (!saved.ok) {
    return { ok: false, errors: [{ field: "recipe", message: "save_failed" }] };
  }

  const response = await apiFetch(`/api/recipes/${id}/publish`, { method: "POST" });
  if (response.status === 422) {
    return { ok: false, errors: await response.json() };
  }
  if (!response.ok) {
    return { ok: false, errors: [{ field: "recipe", message: "save_failed" }] };
  }
  return { ok: true };
}
