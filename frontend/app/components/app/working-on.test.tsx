import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { WorkingOn } from "./working-on";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function shown() {
  return document.querySelector('[data-turn="on"] svg')?.getAttribute("data-food");
}

it("turns the foods that were typed, one after the other", () => {
  renderWithIntl(<WorkingOn label="On cherche…" words="poulet, carottes" progress={null} />);
  expect(shown()).toBe("drumstick");
  act(() => vi.advanceTimersByTime(1100));
  expect(shown()).toBe("carrot");
  act(() => vi.advanceTimersByTime(1100));
  expect(shown()).toBe("drumstick");
});

it("pulses rather than counting before the first dish, then counts what the stream said", () => {
  const { rerender } = renderWithIntl(
    <WorkingOn label="On écrit…" progress={null} />,
  );
  const bar = screen.getByRole("progressbar");
  expect(bar).not.toHaveAttribute("aria-valuenow");
  expect(screen.getByRole("status")).toHaveTextContent("Premier plat en cours…");

  // Every dish is two halves — written, then drawn — so fourteen dishes are
  // twenty-eight steps, and the bar does not sit still while a picture comes.
  rerender(<WorkingOn label="On écrit…" progress={{ done: 3, of: 14, title: "Curry de poulet" }} />);
  expect(bar).toHaveAttribute("aria-valuenow", "3");
  expect(bar).toHaveAttribute("aria-valuemax", "28");
  expect(screen.getByRole("status")).toHaveTextContent("Plat 3 sur 14 · Curry de poulet");

  rerender(
    <WorkingOn label="On écrit…" progress={{ done: 3, of: 14, title: "Curry de poulet" }} drawn={2} />,
  );
  expect(bar).toHaveAttribute("aria-valuenow", "5");
});

it("says the step in words: writing the second recipe, then drawing its picture", () => {
  const { rerender } = renderWithIntl(
    <WorkingOn label="On cherche…" progress={{ done: 2, of: 3, title: "Poulet" }} step={{ index: 2, phase: "writing" }} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("2.1 Nous concoctons votre deuxième recette");
  rerender(
    <WorkingOn label="On cherche…" progress={{ done: 2, of: 3, title: "Poulet" }} step={{ index: 2, phase: "drawing" }} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("2.2 Nous réalisons votre deuxième image");
});
