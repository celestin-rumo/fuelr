/**
 * The cuisines a recipe can belong to — at most one.
 *
 * Mirrored from the backend's `Cuisine`, and closed for the reason the seasons
 * are: "fill my week with Italian food" has to be computable, and it is not if
 * the value is whatever somebody typed.
 *
 * At most one on a recipe, unlike a season — a dish is not of two cuisines at
 * a time. The *filter* takes several, and that asks for either: the same
 * distinction the seasons already make, where a recipe carries several and a
 * filter offers a choice.
 *
 * Twelve, deliberately. Every entry is a chip somebody reads past, and a
 * cuisine nobody cooks costs everybody and serves nobody.
 */
export const CUISINES = [
  "ITALIAN",
  "FRENCH",
  "SWISS",
  "SPANISH",
  "GREEK",
  "LEBANESE",
  "MOROCCAN",
  "INDIAN",
  "THAI",
  "CHINESE",
  "JAPANESE",
  "MEXICAN",
] as const;

export type Cuisine = (typeof CUISINES)[number];

export function isCuisine(value: unknown): value is Cuisine {
  return CUISINES.includes(value as Cuisine);
}
