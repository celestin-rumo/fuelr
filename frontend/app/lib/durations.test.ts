import { describe, expect, it } from "vitest";
import { clock, durationsIn, totalMinutes } from "./durations";

/**
 * The shared table. `RecipeDurationTest` on the backend runs the same cases
 * against `RecipeService.minutesFor`, because the card's total time and the
 * timers offered on the steps are read from one rule expressed twice. A case
 * added here belongs there too.
 */
const TABLE: [string, number[]][] = [
  ["Cuire 15 min.", [15]],
  ["Cuire 15min.", [15]],
  ["Laisser reposer 20 minutes.", [20]],
  ["20 Minuten ruhen lassen.", [20]],
  ["Bake for 20 mins.", [20]],
  ["Mijoter 1 h.", [60]],
  ["Mijoter 1h30.", [90]],
  ["Mijoter 1 h 30.", [90]],
  ["Mijoter 1 h 30 min.", [60, 30]],
  ["Cuire 2 heures.", [120]],
  ["1 Stunde backen.", [60]],
  ["Cuire 10 min, puis dorer 5 min.", [10, 5]],
  // Not durations, and a step that offers a timer for one of these is worse
  // than a step that offers none.
  ["Pour 15 personnes.", []],
  ["Préchauffer le four à 180 °C.", []],
  ["Compter 5 minimum par convive.", []],
  ["Ajouter 30 g de beurre.", []],
];

describe("durationsIn", () => {
  for (const [text, expected] of TABLE) {
    it(`reads ${JSON.stringify(text)} as ${JSON.stringify(expected)}`, () => {
      expect(durationsIn(text).map((d) => d.minutes)).toEqual(expected);
    });
  }

  it("keeps the order of the sentence", () => {
    const found = durationsIn("Dorer 5 min puis mijoter 40 min.");
    expect(found.map((d) => d.minutes)).toEqual([5, 40]);
    expect(found[0].at).toBeLessThan(found[1].at);
  });
});

describe("totalMinutes", () => {
  it("adds up what the steps state", () => {
    expect(totalMinutes(["Cuire 15 min.", "Reposer 1 h 30."])).toBe(105);
  });

  it("counts a step with no stated duration as three minutes", () => {
    // Closer to the truth than zero, and the same figure the backend uses.
    expect(totalMinutes(["Rincer les lentilles.", "Servir."])).toBe(6);
  });
});

describe("clock", () => {
  it("keeps a fixed width so the countdown does not jump", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(9)).toBe("00:09");
    expect(clock(90)).toBe("01:30");
    expect(clock(3600)).toBe("60:00");
  });

  it("never counts below zero", () => {
    expect(clock(-4)).toBe("00:00");
  });
});
