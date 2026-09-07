/**
 * What somebody does not eat — the two closed lists, mirrored from the
 * backend's `Diet` and `Allergen`.
 *
 * Closed for the reason the seasons are: "without peanuts" has to be
 * computable, and it is not if it is whatever somebody typed. A separate
 * module from `api.ts` because that one imports `next/headers`, and a client
 * component that reads a *value* from it drags the server into the bundle.
 */
export const DIETS = ["NONE", "PESCATARIAN", "VEGETARIAN", "VEGAN"] as const;
export type Diet = (typeof DIETS)[number];

/** The fourteen of the European declaration. */
export const ALLERGENS = [
  "GLUTEN", "CRUSTACEANS", "EGGS", "FISH", "PEANUTS", "SOY", "MILK", "NUTS",
  "CELERY", "MUSTARD", "SESAME", "SULPHITES", "LUPIN", "MOLLUSCS",
] as const;
export type Allergen = (typeof ALLERGENS)[number];
