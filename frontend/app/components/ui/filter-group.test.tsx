import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { FilterPanel, FilterTrigger } from "./filter-group";

it("says on its face how many of its options are on", () => {
  render(<FilterTrigger count={2}>Cuisine</FilterTrigger>);
  const trigger = screen.getByRole("button", { name: /Cuisine/ });
  expect(trigger).toHaveTextContent("2");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("shows no count while nothing is on, and says when it is open", () => {
  render(<FilterTrigger open>Saison</FilterTrigger>);
  const trigger = screen.getByRole("button", { name: "Saison" });
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(trigger.querySelector(".font-mono")).toBeNull();
});

it("names its panel after its trigger", () => {
  render(
    <>
      <FilterTrigger id="t" aria-controls="p" open>Saison</FilterTrigger>
      <FilterPanel id="p" labelledBy="t">
        <button type="button">Été</button>
      </FilterPanel>
    </>,
  );
  expect(screen.getByRole("group", { name: "Saison" })).toContainElement(
    screen.getByRole("button", { name: "Été" }),
  );
});
