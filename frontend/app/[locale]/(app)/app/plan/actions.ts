"use server";

import { apiFetch } from "@app/lib/api";
import type { WeekPlan } from "@app/lib/api";
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
  patch: { date?: string; slot?: Slot; servings?: number },
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
