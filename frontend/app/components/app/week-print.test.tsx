import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { PlannedMeal, WeekPlan } from "@app/lib/api";
import { WeekPrint } from "./week-print";

const MONDAY = "2026-03-02";
const SUNDAY = "2026-03-08";

function meal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id: 1,
    date: MONDAY,
    slot: "DINNER",
    position: 0,
    recipeId: 7,
    title: "Curry de lentilles",
    servings: 4,
    recipeServings: 4,
    minutes: 25,
    hasPhoto: true,
    kcal: 1800,
    estimated: false,
    plannedBy: null,
    cooked: false,
    inShopping: true,
    ...overrides,
  };
}

function plan(meals: PlannedMeal[] = []): WeekPlan {
  return {
    weekStart: MONDAY,
    householdSize: 4,
    meals,
    days: [],
    shared: false,
    owner: true,
    accounts: 1,
  };
}

it("is seven days across and four meals down, empty cells included", () => {
  renderWithIntl(<WeekPrint plan={plan([meal()])} />);

  // Every slot of every day has a box. A missing row would read as "nothing
  // is ever planned for lunch".
  for (const slot of ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]) {
    expect(screen.getByTestId(`print-cell-${MONDAY}-${slot}`)).toBeInTheDocument();
    expect(screen.getByTestId(`print-cell-${SUNDAY}-${slot}`)).toBeInTheDocument();
  }
  expect(
    within(screen.getByTestId(`print-cell-${MONDAY}-DINNER`)).getByText("Curry de lentilles"),
  ).toBeInTheDocument();
});

it("says the week it is, from a metre away", () => {
  renderWithIntl(<WeekPrint plan={plan()} />);

  expect(screen.getByRole("heading", { name: "Le planning de la semaine" }))
    .toBeInTheDocument();
  expect(screen.getByText("Du 2 mars au 8 mars")).toBeInTheDocument();
});

it("carries the title and the servings, and nothing that addresses one person", () => {
  renderWithIntl(<WeekPrint plan={plan([meal({ servings: 6 })])} />);

  const cell = screen.getByTestId(`print-cell-${MONDAY}-DINNER`);
  expect(within(cell).getByText("6 p.")).toBeInTheDocument();
  // Nutrition totals address one person and would be read by the family; a
  // photograph says nothing to somebody walking past and costs a page of ink.
  expect(screen.queryByText(/1800/)).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("never drops a meal silently", () => {
  const many = [0, 1, 2, 3, 4, 5].map((at) =>
    meal({ id: at + 1, position: at, title: `Plat ${at + 1}` }),
  );
  renderWithIntl(<WeekPrint plan={plan(many)} />);

  const cell = screen.getByTestId(`print-cell-${MONDAY}-DINNER`);
  // Four listed, and the two that did not fit are counted rather than
  // vanished: a sheet that hides a dinner is a lie, "+ 2 autres" is a fact.
  expect(within(cell).getByText("Plat 4")).toBeInTheDocument();
  expect(within(cell).queryByText("Plat 5")).not.toBeInTheDocument();
  expect(within(cell).getByText("+ 2 autres")).toBeInTheDocument();
});

it("says it is a moment rather than a live view", () => {
  renderWithIntl(<WeekPrint plan={plan([meal()])} />);

  // Paper does not synchronise, and somebody will find this sheet in three
  // weeks and take it for the current plan.
  expect(screen.getByText(/un repas déplacé depuis n'y figure pas/)).toBeInTheDocument();
});

it("prints an empty week as an empty grid, not as a failure", () => {
  renderWithIntl(<WeekPrint plan={plan()} />);

  expect(screen.getByTestId("print-week-grid")).toBeInTheDocument();
  expect(screen.getByText("Rien n'est prévu cette semaine.")).toBeInTheDocument();
});
