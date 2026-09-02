"use server";

import { apiFetch } from "@app/lib/api";
import type { Season } from "@app/lib/seasons";

export type IngredientDraft = {
  name: string;
  quantity: number;
  unit: string;
  /**
   * Carried only so the editor can mark the row. It is never sent back: saving
   * the recipe is the cook taking responsibility for the line, which is
   * precisely what clears the doubt.
   */
  needsReview?: boolean;
};

export type RecipeDraft = {
  title: string;
  description: string;
  servings: number;
  level: string | null;
  ingredients: IngredientDraft[];
  steps: string[];
  tags: string[];
  /** Zero, one or several. A closed domain, unlike the tags above. */
  seasons: Season[];
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

export type Nutrition = {
  total: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  servings: number;
  containsEstimates: boolean;
  ingredients: {
    name: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    guessed: boolean;
  }[];
};

/**
 * Nutrition is computed by the backend, never in the browser: the same
 * arithmetic has to serve the future React Native client from the same
 * reference table.
 */
export async function computeNutrition(
  ingredients: IngredientDraft[],
  servings: number,
): Promise<Nutrition | null> {
  if (ingredients.length === 0) return null;

  const response = await apiFetch("/api/nutrition/compute", {
    method: "POST",
    body: JSON.stringify({ ingredients, servings }),
  });
  if (!response.ok) return null;
  return response.json();
}

/** Pins or unpins a recipe. Its own call, so the grid flips without a reload. */
export async function setFavorite(id: number, favorite: boolean) {
  const response = await apiFetch(`/api/recipes/${id}/favorite`, {
    method: "PUT",
    body: JSON.stringify({ favorite }),
  });
  return { ok: response.ok };
}

/** Moves a pinned recipe one position. Direction is -1 (up) or 1 (down). */
export async function moveFavorite(id: number, direction: -1 | 1) {
  const response = await apiFetch(`/api/recipes/${id}/favorite/move`, {
    method: "PUT",
    body: JSON.stringify({ direction }),
  });
  return { ok: response.ok };
}

export async function duplicateRecipe(id: number, suffix: string) {
  const response = await apiFetch(
    `/api/recipes/${id}/duplicate?suffix=${encodeURIComponent(suffix)}`,
    { method: "POST" },
  );
  if (!response.ok) return { ok: false as const };
  const copy = await response.json();
  return { ok: true as const, id: copy.id as number };
}

export async function deleteRecipe(id: number) {
  const response = await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}
