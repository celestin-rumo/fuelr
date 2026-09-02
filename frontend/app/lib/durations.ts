/**
 * Durations read out of a step's own text — "15 min", "1 h 30", "20 Minuten".
 *
 * This is the second half of one rule. The first is
 * `RecipeService.minutesFor`, which sets the total time on every recipe card
 * from exactly these matches. If the two drifted apart the app would
 * contradict itself out loud: a card promising 45 minutes over steps that
 * offer no timer, or three timers adding up to more than the card says. So the
 * pattern below is the Java one transcribed, and `durations.test.ts` and
 * `RecipeDurationTest` run the same table.
 *
 * A step has no duration column and is not getting one: parsing the text is
 * what makes an imported recipe work without anyone re-typing it.
 */

/** Longest first, so "minutes" is never read as "min" followed by "utes". */
const UNIT = "minutes?|minuten|mins?|mn|heures?|hours?|stunden?|std|h";

/**
 * A unit must not be the start of a longer word: without this "5 minimum"
 * reads as five minutes, and "1 heure" as one hour followed by "eure".
 */
const NOT_LETTER = "(?![a-zA-ZÀ-ÖØ-öø-ÿ])";

/**
 * The trailing group is what makes "1 h 30" ninety minutes rather than sixty:
 * a bare number after an hour is its minutes. It is refused when that number
 * carries a unit of its own, so "1 h 30 min" is still read as two durations
 * adding to the same ninety.
 *
 * `(?!\d)` is what stops it settling for half a number: without it "1 h 30
 * min" backtracks to the "3" of "30", reads three minutes, and quietly makes
 * the step 63 minutes long.
 */
const PATTERN = `(\\d+)\\s*(${UNIT})${NOT_LETTER}(?:\\s*(\\d{1,2})(?!\\d)(?!\\s*(?:${UNIT})${NOT_LETTER}))?`;

export type StepDuration = {
  /** Whole minutes, as the step states them. */
  minutes: number;
  /** Where the match starts, so the chips keep the order of the sentence. */
  at: number;
};

export function durationsIn(text: string): StepDuration[] {
  const found: StepDuration[] = [];
  const matcher = new RegExp(PATTERN, "gi");

  for (const match of text.matchAll(matcher)) {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    // "min", "mins", "minute", "minuten", "mn" — everything else is an hour.
    const hours = !unit.startsWith("m");
    const extra = hours && match[3] ? Number(match[3]) : 0;
    const minutes = hours ? value * 60 + extra : value;

    if (minutes > 0) found.push({ minutes, at: match.index });
  }

  return found;
}

/**
 * The total the recipe card shows, recomputed here so an offline session can
 * still say how long the recipe takes. A step stating no duration counts as
 * three minutes, which is closer to the truth than counting it as zero —
 * `RecipeService.minutesFor` says the same in Java.
 */
export function totalMinutes(steps: string[]): number {
  let total = 0;
  for (const step of steps) {
    const stated = durationsIn(step).reduce((sum, d) => sum + d.minutes, 0);
    total += stated > 0 ? stated : 3;
  }
  return total;
}

/** mm:ss, for a countdown that must not change width as it runs. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
