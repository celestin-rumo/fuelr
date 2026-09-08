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
  // One call, like the week and the batch: the provenance is written by the
  // hand that creates the row, and the picture follows a few seconds later.
  // The two-step dance this replaced left the origin at TYPED and drew
  // nothing — a dish from the bag looked like one somebody had written.
  const created = await apiFetch("/api/recipes/from-idea", {
    method: "POST",
    body: JSON.stringify({
      title: suggestion.title,
      minutes: suggestion.minutes,
      ingredients: suggestion.ingredients.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
      })),
      steps: suggestion.steps,
    }),
  });
  if (!created.ok) return { ok: false as const };
  const { id } = (await created.json()) as { id: number };
  return { ok: true as const, id };
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
