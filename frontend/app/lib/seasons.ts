/**
 * The four seasons a recipe can carry.
 *
 * A closed domain, mirrored from the backend's `Season`: it is what lets "what
 * is in season now" be derived from the date rather than guessed from a tag
 * somebody typed.
 */
export const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as const;

export type Season = (typeof SEASONS)[number];

/**
 * The season a calendar day falls in, northern hemisphere.
 *
 * That assumption is the app's, not a fact: south of the equator these are
 * exactly wrong. The day Fuelr ships there this has to follow the account
 * rather than the calendar, which is why it is one function rather than a
 * comparison written into three screens. The date comes from the server, so
 * the answer is the same on both sides of hydration.
 */
export function seasonOf(iso: string): Season {
  const month = Number(iso.slice(5, 7));
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  if (month >= 9 && month <= 11) return "AUTUMN";
  return "WINTER";
}

export function isSeason(value: unknown): value is Season {
  return SEASONS.includes(value as Season);
}
