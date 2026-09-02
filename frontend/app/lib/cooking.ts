import type { Recipe } from "./api";

/**
 * The steps cooking mode will actually show.
 *
 * The editor lets a step exist while it is still empty — a blank card is a
 * normal state while writing. A blank screen is not a step, so cooking mode
 * drops them, and the guard that decides whether a recipe can be cooked at all
 * uses this same list. One rule, so the button and the route cannot disagree.
 */
export function cookableSteps(recipe: Pick<Recipe, "steps">): string[] {
  return recipe.steps.filter((step) => step.trim().length > 0);
}

/**
 * Scales a quantity from the servings the recipe was written for to the
 * servings being cooked tonight.
 *
 * Display only. The scaled figure never reaches the API: a recipe written for
 * four stays written for four, whoever is eating.
 */
export function scaleQuantity(quantity: number, from: number, to: number): number {
  if (!(from > 0)) return quantity;
  return (quantity * to) / from;
}

/**
 * Two decimals, trailing zeros trimmed — except for a quantity so small that
 * rounding would print `0`, which reads as "none of it" rather than "a little
 * of it". A pinch of saffron scaled down must not vanish.
 */
export function formatQuantity(value: number, locale: string): string {
  if (value > 0 && value < 0.01) {
    return new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/** The bounds the editor enforces server-side, mirrored here. */
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 12;
