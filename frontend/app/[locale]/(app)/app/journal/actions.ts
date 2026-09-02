"use server";

import { apiFetch } from "@app/lib/api";
import type { LogHistory, NutritionDetail, NutritionTargets } from "@app/lib/api";

export type LogInput = {
  date: string;
  slot?: string;
  title?: string;
  recipeId?: number;
  servings?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};

/** A meal at a restaurant, or a recipe eaten. Both are free. */
export async function logMeal(input: LogInput) {
  const response = await apiFetch("/api/log", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { ok: response.ok };
}

export async function removeEntry(id: number) {
  const response = await apiFetch(`/api/log/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}

export type TargetResult =
  | { ok: true; targets: NutritionTargets }
  | { ok: false; reason: "upgrade_required" | "failed" };

/** Setting a target is part of tracking, and tracking is paid for. */
export async function setTargets(targets: {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}): Promise<TargetResult> {
  const response = await apiFetch("/api/log/targets", {
    method: "PUT",
    body: JSON.stringify(targets),
  });
  if (response.ok) return { ok: true, targets: await response.json() };
  if (response.status === 402) return { ok: false, reason: "upgrade_required" };
  return { ok: false, reason: "failed" };
}

/**
 * Day totals over a range. The free plan comes back clamped to its window
 * rather than refused — the answer is smaller, not an error.
 */
export async function history(from: string, to: string) {
  const response = await apiFetch(`/api/log/history?from=${from}&to=${to}`);
  if (!response.ok) return null;
  return (await response.json()) as LogHistory;
}

export type DetailResult =
  | { ok: true; detail: NutritionDetail }
  | { ok: false; reason: "upgrade_required" | "failed" };

/** The paid detail of one recipe's ingredients. */
export async function nutritionDetail(
  ingredients: { name: string; quantity: number; unit: string }[],
  servings: number,
): Promise<DetailResult> {
  const response = await apiFetch("/api/nutrition/detail", {
    method: "POST",
    body: JSON.stringify({ ingredients, servings }),
  });
  if (response.ok) return { ok: true, detail: await response.json() };
  if (response.status === 402) return { ok: false, reason: "upgrade_required" };
  return { ok: false, reason: "failed" };
}
