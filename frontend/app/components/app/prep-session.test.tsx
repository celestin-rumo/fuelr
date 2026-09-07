import { screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { PrepSession } from "@app/lib/api";
import { PrepSessionView } from "./prep-session";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

const MONDAY = "2026-03-02";

function session(overrides: Partial<PrepSession> = {}): PrepSession {
  return {
    weekStart: MONDAY,
    bases: [
      { name: "Lentilles", unit: "g", quantity: 500, dishes: ["Dahl", "Soupe"] },
    ],
    dishes: [
      {
        mealId: 1,
        date: MONDAY,
        slot: "DINNER",
        title: "Dahl",
        minutes: 40,
        servings: 4,
        steps: ["Faire revenir les épices."],
        rest: [{ name: "Curry", quantity: 1, unit: "c.à.s" }],
      },
      {
        mealId: 2,
        date: "2026-03-03",
        slot: "DINNER",
        title: "Soupe",
        minutes: 25,
        servings: 4,
        steps: [],
        rest: [],
      },
    ],
    ...overrides,
  };
}

it("puts what is prepared once for several dishes first, with its total", () => {
  renderWithIntl(<PrepSessionView session={session()} week={MONDAY} />);

  const bases = screen.getByTestId("prep-bases");
  expect(within(bases).getByText("Lentilles")).toBeInTheDocument();
  expect(within(bases).getByText("500 g")).toBeInTheDocument();
  expect(within(bases).getByText(/Dahl · Soupe/)).toBeInTheDocument();
});

it("does not ask a second time for what the bases already made", () => {
  renderWithIntl(<PrepSessionView session={session()} week={MONDAY} />);

  const dishes = screen.getByTestId("prep-dishes");
  // Only what is left; the lentils are not repeated under the dish.
  expect(within(dishes).getByText("1 c.à.s Curry")).toBeInTheDocument();
  expect(within(dishes).queryByText(/Lentilles/)).not.toBeInTheDocument();
  // And a dish with nothing left says the best thing it can say.
  expect(
    within(dishes).getByText("Tout est déjà prêt dans les bases communes."),
  ).toBeInTheDocument();
});

it("never says how long anything keeps", () => {
  renderWithIntl(<PrepSessionView session={session()} week={MONDAY} />);

  // The one health claim this application refuses to make.
  expect(screen.getByTestId("prep-keeping")).toHaveTextContent(
    /ne connaît pas les durées de conservation/,
  );
});

it("treats a week with no shared base as varied rather than broken", () => {
  renderWithIntl(<PrepSessionView session={session({ bases: [] })} week={MONDAY} />);

  expect(screen.queryByTestId("prep-bases")).not.toBeInTheDocument();
  expect(screen.getByText(/c'est une semaine variée, pas un problème/)).toBeInTheDocument();
  // The dishes are still there: an afternoon with no shared base is still an
  // afternoon somebody is going to spend.
  expect(screen.getByTestId("prep-dishes")).toBeInTheDocument();
});

it("sends somebody to the planner when there is nothing on the week", () => {
  renderWithIntl(<PrepSessionView session={session({ dishes: [] })} week={MONDAY} />);

  expect(screen.getByText("Rien à préparer cette semaine")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Aller au planning" })).toBeInTheDocument();
});
