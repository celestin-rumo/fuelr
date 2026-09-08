import { expect, it } from "vitest";
import { KITCHEN, iconsFor } from "./food-words";

it("turns what was typed into the foods it names, in order, each once", () => {
  expect(iconsFor("poulet, carottes, un citron, des carottes")).toEqual([
    "drumstick",
    "carrot",
    "lemon",
  ]);
});

it("speaks the three languages, accents and plurals aside", () => {
  expect(iconsFor("Hähnchen mit Rüebli")).toEqual(["drumstick", "carrot"]);
  expect(iconsFor("chicken and carrots")).toEqual(["drumstick", "carrot"]);
  expect(iconsFor("Œufs, épinards")).toEqual(["egg", "leaf"]);
});

it("knows a potato from an apple", () => {
  expect(iconsFor("pommes de terre")).toEqual(["potato"]);
  expect(iconsFor("pommes")).toEqual(["apple"]);
});

it("reads a title the way it reads a bag", () => {
  expect(iconsFor("Soupe de courge")).toEqual(["bowl", "leaf"]);
});

it("draws the kitchen when nothing was recognised", () => {
  expect(iconsFor("")).toEqual(KITCHEN);
  expect(iconsFor("xyzzy plugh")).toEqual(KITCHEN);
});
