/**
 * Calendar arithmetic for the week plan.
 *
 * Every date here is a plain `YYYY-MM-DD` string, and every computation runs in
 * UTC. A planned meal is a calendar day, not an instant: "Wednesday dinner" is
 * Wednesday whatever the clock says, and doing the arithmetic on local Dates
 * would move meals across midnight for anyone west of Greenwich and lose an
 * hour twice a year. `todayIso` is the one deliberate exception — which day
 * *today* is can only be answered locally.
 */

/** The four rows of the grid, in the order a day is eaten. */
export const SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export type Slot = (typeof SLOTS)[number];

export const DAYS_IN_WEEK = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC on the given day, so no timezone can shift it. */
export function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DATE.test(value) &&
    !Number.isNaN(utcDate(value).getTime())
  );
}

export function isSlot(value: unknown): value is Slot {
  return SLOTS.includes(value as Slot);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = utcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/**
 * The Monday of the week containing `iso`. The backend applies the same rule,
 * so the two never disagree about which week a Sunday belongs to.
 */
export function mondayOf(iso: string): string {
  // getUTCDay is 0 on Sunday; the week starts on Monday, so Sunday is 6 days in.
  const shift = (utcDate(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -shift);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));
}

/** Today's calendar day where the person actually is. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Formats a calendar day for display, pinned to UTC.
 *
 * Left to the runtime's own zone this would render one day on the server and
 * another in the browser, which React reports as a hydration failure rather
 * than as the timezone bug it is.
 */
export function formatDay(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    utcDate(iso),
  );
}
