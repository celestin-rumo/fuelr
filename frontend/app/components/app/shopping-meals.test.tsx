import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { PlannedMeal } from "@app/lib/api";
import { ShoppingMeals } from "./shopping-meals";

const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const updatePlannedMeal = vi.fn(async () => ({ ok: true }));

vi.mock("@app/[locale]/(app)/app/plan/actions", () => ({
  updatePlannedMeal: (...args: unknown[]) => updatePlannedMeal(...(args as [])),
}));

function meal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id: 11,
    date: "2026-03-04",
    slot: "DINNER",
    position: 0,
    recipeId: 7,
    title: "Curry de lentilles",
    servings: 4,
    recipeServings: 4,
    minutes: 25,
    hasPhoto: false,
    kcal: 1800,
    estimated: false,
    plannedBy: null,
    cooked: false,
    inShopping: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("takes a meal out of the list without taking it off the plan", async () => {
  const user = userEvent.setup();
  renderWithIntl(<ShoppingMeals meals={[meal()]} />);

  await user.click(screen.getByTestId("meal-in-shopping-11"));

  await waitFor(() => expect(updatePlannedMeal).toHaveBeenCalledTimes(1));
  expect(updatePlannedMeal.mock.calls[0]).toEqual([11, { inShopping: false }]);
});

it("counts what was taken out, and only when something was", () => {
  const { unmount } = renderWithIntl(<ShoppingMeals meals={[meal()]} />);
  expect(screen.queryByTestId("excluded-count")).not.toBeInTheDocument();
  unmount();

  renderWithIntl(<ShoppingMeals meals={[meal({ inShopping: false })]} />);
  expect(screen.getByTestId("excluded-count")).toHaveTextContent("1 retiré");
});

it("says nothing at all about a week with nothing planned", () => {
  renderWithIntl(<ShoppingMeals meals={[]} />);
  expect(screen.queryByTestId("shopping-meals")).not.toBeInTheDocument();
});
