import { describe, expect, it } from "vitest";
import {
  cookableSteps,
  formatQuantity,
  scaleQuantity,
} from "./cooking";

describe("cookableSteps", () => {
  it("drops the steps that are still empty", () => {
    expect(
      cookableSteps({ steps: ["Faire revenir l'oignon.", "", "   ", "Servir."] }),
    ).toEqual(["Faire revenir l'oignon.", "Servir."]);
  });

  it("reports nothing to cook when every step is blank", () => {
    expect(cookableSteps({ steps: ["", " "] })).toEqual([]);
  });
});

describe("scaleQuantity", () => {
  it("scales down to a third", () => {
    expect(scaleQuantity(100, 3, 1)).toBeCloseTo(33.333, 3);
  });

  it("scales up by two and a half", () => {
    expect(scaleQuantity(0.5, 2, 5)).toBeCloseTo(1.25, 5);
  });

  it("leaves the quantity alone when the recipe states no servings", () => {
    // A zero would otherwise divide, and Infinity grams is worse than the
    // number the author actually wrote.
    expect(scaleQuantity(200, 0, 4)).toBe(200);
  });
});

describe("formatQuantity", () => {
  it("keeps a whole number whole", () => {
    expect(formatQuantity(100, "fr")).toBe("100");
  });

  it("stops at two decimals, in the locale's own notation", () => {
    expect(formatQuantity(33.3333, "fr")).toBe("33,33");
    expect(formatQuantity(33.3333, "en")).toBe("33.33");
  });

  it("never rounds a pinch down to nothing", () => {
    // 0.002 g of saffron is a pinch; "0" would say there is none.
    expect(formatQuantity(0.002, "en")).toBe("0.002");
  });

  it("shows zero as zero", () => {
    expect(formatQuantity(0, "fr")).toBe("0");
  });
});
