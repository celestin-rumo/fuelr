import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The design system claims contrast ratios. This measures them.
 *
 * `--gray` sat at 3.3:1 on `--bg-raised-2` while carrying every label, meta
 * line and hint in the application — text, at 11 and 12 pixels, which WCAG
 * asks 4.5:1 of. Nothing said so, because the ratios were written in a table
 * and never computed from the tokens.
 *
 * This reads `globals.css` rather than a page, on purpose. `e2e/accessibility`
 * runs axe over what is rendered and catches the same class of problem, but
 * only where a page happens to use the pair; this catches a bad token the
 * moment it is written, in a second, with no browser.
 */
const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** The value of a custom property, inside `:root` (dark) or `.light`. */
function token(name: string, theme: "dark" | "light"): string {
  const block =
    theme === "dark"
      ? CSS.slice(CSS.indexOf(":root {"), CSS.indexOf(".light {"))
      : CSS.slice(CSS.indexOf(".light {"), CSS.indexOf("@theme inline"));

  // The last declaration wins, which is what the cascade does too.
  const matches = [...block.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))];
  const found = matches.at(-1)?.[1].trim();
  // A token the light theme does not override keeps the dark value.
  return found ?? token(name, "dark");
}

function channels(colour: string) {
  const hex = colour.replace("#", "");
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
}

function luminance(colour: string) {
  const [r, g, b] = channels(colour).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Every surface a piece of text can sit on. The darkest is not the worst. */
const GROUNDS = ["--bg", "--bg-raised", "--bg-raised-2"] as const;

/** WCAG AA, normal text. The labels this covers are 11px and 12px. */
const TEXT_FLOOR = 4.5;

/** WCAG AA, non-text: a border, an icon, the edge of a control. */
const OBJECT_FLOOR = 3;

describe.each(["dark", "light"] as const)("%s theme", (theme) => {
  const on = (colour: string) =>
    Math.min(...GROUNDS.map((ground) => ratio(colour, token(ground, theme))));

  it.each([
    ["--text", TEXT_FLOOR],
    ["--text-dim", TEXT_FLOOR],
    // The one that was failing: it carries labels, so it is text.
    ["--gray", TEXT_FLOOR],
    ["--lime-ink", TEXT_FLOOR],
    ["--mint-ink", TEXT_FLOOR],
    ["--coral-ink", TEXT_FLOOR],
  ])("%s reads on every surface", (name, floor) => {
    const worst = on(token(name, theme));
    expect(
      worst,
      `${name} is ${worst.toFixed(2)}:1 at worst, below the ${floor}:1 floor`,
    ).toBeGreaterThanOrEqual(floor);
  });

  it("ink on a flat accent fill reads", () => {
    // The other direction: dark text on lime, mint and coral.
    for (const accent of ["--lime", "--mint", "--coral"]) {
      const found = ratio(token("--on-accent", theme), token(accent, theme));
      expect(
        found,
        `--on-accent on ${accent} is ${found.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it("the focus ring is visible against every surface", () => {
    // The first criterion of the story, and the one place the non-text floor
    // genuinely binds: a focus ring is *only* a boundary. Nothing else says
    // where the keyboard is.
    const worst = on(token("--mint-ink", theme));
    expect(
      worst,
      `the focus ring is ${worst.toFixed(2)}:1 at worst`,
    ).toBeGreaterThanOrEqual(OBJECT_FLOOR);
  });

  it("a field's border is visible, because it is the whole field", () => {
    // `input.tsx` draws its box with `border-gray`. A field whose edge cannot
    // be seen is a field somebody does not know is there.
    const worst = on(token("--gray", theme));
    expect(
      worst,
      `a field's border is ${worst.toFixed(2)}:1 at worst`,
    ).toBeGreaterThanOrEqual(OBJECT_FLOOR);
  });

  // Deliberately not asserted: a flat accent against its ground. `--lime` on
  // a white card is 1.08:1, and that is not a failure — WCAG asks 3:1 of a
  // boundary only where the boundary is what identifies the control. A lime
  // button carries `--on-accent` at 12:1 and is identified by its own label.
  // Asserting it here would fail on something correct, and a suite that fails
  // on something correct gets switched off.
});
