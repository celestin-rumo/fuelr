"use server";

import { apiFetch } from "@app/lib/api";
import type { Suggestion } from "@app/lib/api";

/**
 * Turns an idea into a draft to correct.
 *
 * The same shape every import produces: a DRAFT, opened in the editor, with
 * every guessed quantity flagged. Nothing a model proposed is ever written
 * into the library as a finished recipe.
 */
export async function draftFromIdea(suggestion: Suggestion) {
  const created = await apiFetch("/api/recipes", { method: "POST" });
  if (!created.ok) return { ok: false as const };
  const { id } = (await created.json()) as { id: number };

  const saved = await apiFetch(`/api/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: suggestion.title,
      servings: 4,
      totalMinutes: suggestion.minutes,
      ingredients: suggestion.ingredients.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        needsReview: line.needsReview,
      })),
      steps: suggestion.steps,
    }),
  });
  return saved.ok ? { ok: true as const, id } : { ok: false as const };
}

/** What the bag does not hold, added to the week being shopped for. */
export async function addMissingToList(week: string, missing: string[]) {
  for (const name of missing) {
    const response = await apiFetch(`/api/shopping/items?week=${week}`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!response.ok) return { ok: false as const };
  }
  return { ok: true as const };
}
