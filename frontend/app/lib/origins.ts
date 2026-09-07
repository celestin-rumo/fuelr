/**
 * Where a recipe came from.
 *
 * Provenance, not a tag. The tags describe the dish — vegetarian, quick,
 * cheap — and are ticked by hand in the editor; a marker saying "a model wrote
 * this" must not be one of them, or somebody can tick it on a recipe they
 * typed and it stops meaning anything.
 *
 * Mirrored from the backend's `Recipe.Origin`. It is written by the code that
 * creates the recipe and never sent by the editor, which is what makes it
 * worth showing at all.
 */
export const ORIGINS = ["TYPED", "IMPORTED", "AI"] as const;

export type RecipeOrigin = (typeof ORIGINS)[number];

export function isOrigin(value: unknown): value is RecipeOrigin {
  return ORIGINS.includes(value as RecipeOrigin);
}
