"use server";

import { apiFetch } from "@app/lib/api";
import type {
  BatchSets,
  RecipeIdea,
  WeekPlan,
  WeekSuggestion,
} from "@app/lib/api";
import type { Slot } from "@app/lib/week";

/**
 * Every action here answers `{ ok }` rather than throwing. The planner is a
 * grid someone is dragging things around in: a failed drop has to put the card
 * back, not replace the screen with an error page.
 */

export async function planMeal(input: {
  date: string;
  slot: Slot;
  recipeId: number;
  /** Left out on purpose so the backend applies the household size. */
  servings?: number;
}) {
  const response = await apiFetch("/api/plan", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { ok: response.ok };
}

/** Moves a meal, re-portions it, or both. Nothing is re-entered. */
export async function updatePlannedMeal(
  id: number,
  patch: { date?: string; slot?: Slot; servings?: number; inShopping?: boolean },
) {
  const response = await apiFetch(`/api/plan/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return { ok: response.ok };
}

export async function removePlannedMeal(id: number) {
  const response = await apiFetch(`/api/plan/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}

export type CopyWeekResult =
  | { ok: true; week: WeekPlan }
  /** The target week already holds meals; the screen asks before replacing. */
  | { ok: false; conflict: true }
  | { ok: false; conflict: false };

export async function copyWeek(
  from: string,
  to: string,
  replace = false,
): Promise<CopyWeekResult> {
  const response = await apiFetch("/api/plan/copy", {
    method: "POST",
    body: JSON.stringify({ from, to, replace }),
  });
  if (response.status === 409) return { ok: false, conflict: true };
  if (!response.ok) return { ok: false, conflict: false };
  return { ok: true, week: await response.json() };
}

/**
 * Says a meal was actually cooked, which is what takes its ingredients out of
 * the cupboard. Unmarking it puts nothing back — nobody knows whether the food
 * was un-eaten.
 */
export async function markCooked(id: number, cooked: boolean) {
  const response = await apiFetch(`/api/plan/${id}/cooked`, {
    method: cooked ? "POST" : "DELETE",
  });
  return { ok: response.ok };
}

/**
 * The default for meals planned from here on. Meals already on the grid keep
 * the servings they were given.
 */
export async function setHouseholdSize(size: number) {
  const response = await apiFetch("/api/plan/household", {
    method: "PUT",
    body: JSON.stringify({ size }),
  });
  return { ok: response.ok };
}

/**
 * Asks for a week in a direction — light, high in protein, Italian.
 *
 * Nothing is written by this: what comes back is a proposal, which is what
 * makes correcting it possible at all. `keep` is the slots already decided,
 * per slot rather than per day, and `excludeTitles` is what has already been
 * seen or refused — a dish that comes back after being turned down is the
 * fastest way to lose somebody.
 */
export async function suggestWeek(input: {
  week: string;
  intents: string[];
  cuisines: string[];
  slots: Slot[];
  keep: { date: string; slot: Slot }[];
  excludeTitles: string[];
  /** What somebody typed when refusing. Optional, and it only reaches a model. */
  note?: string;
}): Promise<{ ok: true; suggestion: WeekSuggestion } | { ok: false }> {
  const response = await apiFetch("/api/plan/suggest", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false };
  return { ok: true, suggestion: await response.json() };
}

/**
 * Writes an accepted proposal onto the week.
 *
 * The dish does not exist yet — this screen never proposes something already
 * in the library — so it is written first, as a DRAFT marked as a model's
 * work, with every guessed quantity flagged. One call rather than a create
 * followed by an update: the two-step dance leaves a titleless recipe behind
 * whenever the second half fails, and the provenance has to be set by the
 * same hand that creates the row.
 */
export async function acceptProposal(proposal: {
  date: string;
  slot: Slot;
  title: string;
  idea: RecipeIdea | null;
}) {
  if (!proposal.idea) return { ok: false };

  const created = await apiFetch("/api/recipes/from-idea", {
    method: "POST",
    body: JSON.stringify({
      title: proposal.idea.title,
      minutes: proposal.idea.minutes,
      ingredients: proposal.idea.ingredients,
      steps: proposal.idea.steps,
    }),
  });
  if (!created.ok) return { ok: false };
  const { id } = (await created.json()) as { id: number };

  const planned = await apiFetch("/api/plan", {
    method: "POST",
    body: JSON.stringify({ date: proposal.date, slot: proposal.slot, recipeId: id }),
  });
  return { ok: planned.ok };
}

export async function suggestBatch(input: {
  size: number;
  intents: string[];
  cuisines: string[];
  /** Titles already seen or refused; an idea has no id. */
  excludeTitles: string[];
}): Promise<{ ok: true; sets: BatchSets } | { ok: false }> {
  const response = await apiFetch("/api/plan/suggest/batch", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false };
  return { ok: true, sets: await response.json() };
}
