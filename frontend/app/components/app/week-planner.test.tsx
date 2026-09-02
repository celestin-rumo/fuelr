import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { PlannedMeal, RecipeSummary, WeekPlan } from "@app/lib/api";
import { weekDays } from "@app/lib/week";
import { WeekPlanner } from "./week-planner";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  Link: ({
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

const planMeal = vi.fn(async () => ({ ok: true }));
const updatePlannedMeal = vi.fn(async () => ({ ok: true }));
const removePlannedMeal = vi.fn(async () => ({ ok: true }));
const setHouseholdSize = vi.fn(async () => ({ ok: true }));
const copyWeek = vi.fn(async () => ({ ok: true as const, week: {} as WeekPlan }));

vi.mock("@app/[locale]/(app)/app/plan/actions", () => ({
  planMeal: (...args: unknown[]) => planMeal(...(args as [])),
  updatePlannedMeal: (...args: unknown[]) => updatePlannedMeal(...(args as [])),
  removePlannedMeal: (...args: unknown[]) => removePlannedMeal(...(args as [])),
  setHouseholdSize: (...args: unknown[]) => setHouseholdSize(...(args as [])),
  copyWeek: (...args: unknown[]) => copyWeek(...(args as [])),
}));

const MONDAY = "2026-03-02";
const WEDNESDAY = "2026-03-04";

function mealWith(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id: 11,
    date: WEDNESDAY,
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
    ...overrides,
  };
}

function planWith(meals: PlannedMeal[] = [], householdSize = 2): WeekPlan {
  return {
    weekStart: MONDAY,
    householdSize,
    meals,
    days: weekDays(MONDAY).map((date) => {
      const onDay = meals.filter((meal) => meal.date === date);
      return {
        date,
        meals: onDay.length,
        kcal: onDay.length === 0 ? null : 1800,
      };
    }),
  };
}

const RECIPES: RecipeSummary[] = [
  {
    id: 7,
    title: "Curry de lentilles",
    status: "PUBLISHED",
    servings: 4,
    ingredientCount: 3,
    stepCount: 2,
    favorite: false,
    hasPhoto: false,
    minutes: 25,
    kcalPerServing: 450,
    proteinPerServing: 20,
    carbsPerServing: 50,
    fatPerServing: 12,
    estimated: false,
  },
  {
    id: 8,
    title: "Saumon grillé",
    status: "PUBLISHED",
    servings: 2,
    ingredientCount: 2,
    stepCount: 2,
    favorite: false,
    hasPhoto: false,
    minutes: 15,
    kcalPerServing: 520,
    proteinPerServing: 35,
    carbsPerServing: 2,
    fatPerServing: 30,
    estimated: false,
  },
];

function renderPlanner(plan = planWith()) {
  return renderWithIntl(
    <WeekPlanner plan={plan} recipes={RECIPES} today={MONDAY} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WeekPlanner", () => {
  it("shows seven days, each with its four slots", () => {
    renderPlanner();

    for (const date of weekDays(MONDAY)) {
      expect(screen.getByTestId(`day-${date}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId(`slot-${WEDNESDAY}-BREAKFAST`)).toBeInTheDocument();
    expect(screen.getByTestId(`slot-${WEDNESDAY}-LUNCH`)).toBeInTheDocument();
    expect(screen.getByTestId(`slot-${WEDNESDAY}-DINNER`)).toBeInTheDocument();
    expect(screen.getByTestId(`slot-${WEDNESDAY}-SNACK`)).toBeInTheDocument();
  });

  it("treats an empty slot as a normal evening, not as a failure", () => {
    renderPlanner();

    const slot = screen.getByTestId(`slot-${WEDNESDAY}-DINNER`);
    expect(slot).toHaveTextContent("Rien de prévu");
    // Nothing planned is not an error, so it carries no alert and no error tone.
    expect(within(slot).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("plans a recipe onto the slot that was asked for", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(
      screen.getByRole("button", { name: /Ajouter un repas — mercredi, Dîner/ }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Curry de lentilles/,
      }),
    );

    await waitFor(() =>
      expect(planMeal).toHaveBeenCalledWith({
        date: WEDNESDAY,
        slot: "DINNER",
        recipeId: 7,
      }),
    );
    // No servings sent: the household size is the backend's to apply.
    expect(refresh).toHaveBeenCalled();
  });

  it("re-portions a planned meal without touching the recipe", async () => {
    const user = userEvent.setup();
    renderPlanner(planWith([mealWith()]));

    await user.click(
      screen.getByRole("button", { name: /Modifier Curry de lentilles/ }),
    );
    expect(screen.getByTestId("meal-servings")).toHaveTextContent("4");

    await user.click(
      screen.getByRole("button", { name: /Une portion de plus pour Curry/ }),
    );

    await waitFor(() =>
      expect(updatePlannedMeal).toHaveBeenCalledWith(11, { servings: 5 }),
    );
  });

  it("moves a meal to another day without re-entering it", async () => {
    const user = userEvent.setup();
    renderPlanner(planWith([mealWith()]));

    await user.click(
      screen.getByRole("button", { name: /Modifier Curry de lentilles/ }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^ven/ }));

    await waitFor(() =>
      expect(updatePlannedMeal).toHaveBeenCalledWith(11, { date: "2026-03-06" }),
    );
  });

  it("removes a planned meal", async () => {
    const user = userEvent.setup();
    renderPlanner(planWith([mealWith()]));

    await user.click(
      screen.getByRole("button", { name: /Modifier Curry de lentilles/ }),
    );
    await user.click(screen.getByRole("button", { name: "Retirer du planning" }));

    await waitFor(() => expect(removePlannedMeal).toHaveBeenCalledWith(11));
  });

  it("changes the household size, which only sets the default", async () => {
    const user = userEvent.setup();
    renderPlanner(planWith([mealWith()], 2));

    await user.click(screen.getByRole("button", { name: /Une personne de plus/ }));

    await waitFor(() => expect(setHouseholdSize).toHaveBeenCalledWith(3));
    // The meal already on the grid keeps the servings it was planned with.
    expect(updatePlannedMeal).not.toHaveBeenCalled();
  });

  it("copies the week forward and lands on the week it filled", async () => {
    const user = userEvent.setup();
    renderPlanner(planWith([mealWith()]));

    await user.click(
      screen.getByRole("button", { name: "Dupliquer vers la semaine suivante" }),
    );

    await waitFor(() =>
      expect(copyWeek).toHaveBeenCalledWith(MONDAY, "2026-03-09", false),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        pathname: "/app/plan",
        query: { week: "2026-03-09" },
      }),
    );
  });

  it("asks before writing over a week that is already planned", async () => {
    const user = userEvent.setup();
    copyWeek.mockResolvedValueOnce({
      ok: false,
      conflict: true,
    } as unknown as { ok: true; week: WeekPlan });
    renderPlanner(planWith([mealWith()]));

    await user.click(
      screen.getByRole("button", { name: "Dupliquer vers la semaine suivante" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("La semaine suivante est déjà planifiée");
    expect(push).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Remplacer" }));

    await waitFor(() =>
      expect(copyWeek).toHaveBeenLastCalledWith(MONDAY, "2026-03-09", true),
    );
  });

  it("says what to do when a recipe is dropped on a slot", async () => {
    renderPlanner();

    const card = screen.getByTestId("rail-recipe-8");
    const slot = screen.getByTestId(`slot-${WEDNESDAY}-LUNCH`);

    // jsdom drives no real drag, so the two events the component actually
    // owns are fired directly. What is dragged lives in React state, not in
    // the DragEvent, precisely because `dataTransfer` is unreadable during
    // `dragover` — which is what makes this testable at all.
    fireEvent.dragStart(card);
    fireEvent.drop(slot);

    await waitFor(() =>
      expect(planMeal).toHaveBeenCalledWith({
        date: WEDNESDAY,
        slot: "LUNCH",
        recipeId: 8,
      }),
    );
  });
});
