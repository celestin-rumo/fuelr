import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { Recipe } from "@app/lib/api";
import { CookingMode } from "./cooking-mode";

function recipeWith(steps: string[]): Recipe {
  return {
    id: 7,
    title: "Curry de lentilles corail",
    description: null,
    servings: 4,
    level: null,
    status: "PUBLISHED",
    hasPhoto: false,
    ingredients: [],
    steps,
    tags: [],
    sourceUrl: null,
    totalMinutes: null,
    unverified: [],
  };
}

/**
 * Only the calendar is faked, never the timers themselves.
 *
 * That is not a convenience: the timers read the wall clock and recompute from
 * it, so moving the clock forward while the intervals keep running for real is
 * exactly the situation these tests are about — and faking `setTimeout` here
 * takes React's own scheduling with it, after which nothing ever resolves.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Moves the clock, the way being away from the phone does. */
function elapse(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

describe("timers in cooking mode", () => {
  it("offers what the step says, and nothing when it says nothing", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <CookingMode recipe={recipeWith(["Rincer les lentilles.", "Cuire 5 min."])} />,
    );

    // A step stating no duration offers no control at all — not an empty one,
    // not a zero.
    expect(screen.queryByTestId("cook-durations")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Suivante/ }));

    expect(screen.getByRole("button", { name: "⏱ 5 min" })).toBeInTheDocument();
  });

  it("reads an hour and its minutes as one timer", () => {
    renderWithIntl(<CookingMode recipe={recipeWith(["Mijoter 1 h 30."])} />);

    expect(screen.getByRole("button", { name: "⏱ 1 h 30" })).toBeInTheDocument();
  });

  it("counts down, and stays on screen on the next step", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith(["Cuire 5 min.", "Servir."])} />);

    await user.click(screen.getByRole("button", { name: "⏱ 5 min" }));
    expect(screen.getByTestId("cook-timer")).toHaveTextContent("05:00");

    elapse(65_000);
    await waitFor(() =>
      expect(screen.getByTestId("cook-timer")).toHaveTextContent("03:55"),
    );

    // The timer belongs to the pan, not to the step being shown.
    await user.click(screen.getByRole("button", { name: /Suivante/ }));
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 2 sur 2");
    expect(screen.getByTestId("cook-timer")).toHaveTextContent("03:5");
  });

  it("rings, says so out loud, and clears on one tap", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith(["Cuire 1 min."])} />);

    await user.click(screen.getByRole("button", { name: "⏱ 1 min" }));
    elapse(61_000);

    await waitFor(() =>
      expect(screen.getByTestId("cook-timer")).toHaveAttribute("data-state", "ended"),
    );
    expect(screen.getByTestId("cook-timer-ended")).toHaveTextContent("Minuteur terminé");
    // Two nodes carry role="status" here — the banner is one of them — so the
    // announcement is asked for by name rather than by role.
    expect(screen.getByTestId("cook-announcement")).toHaveTextContent(
      "Minuteur terminé : étape 1",
    );

    await user.click(screen.getByRole("button", { name: "C'est noté" }));
    expect(screen.queryByTestId("cook-timer")).not.toBeInTheDocument();
  });

  it("comes back honest from a screen that was off", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith(["Cuire 10 min."])} />);

    await user.click(screen.getByRole("button", { name: "⏱ 10 min" }));

    // Away from the phone: the clock moves, the page does not. A timer counted
    // down tick by tick would come back eleven minutes wrong.
    elapse(11 * 60_000);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const timer = screen.getByTestId("cook-timer");
    expect(timer).toHaveAttribute("data-state", "ended");
    // And it says how long ago, rather than resetting to zero as if nothing
    // had happened.
    expect(timer).toHaveTextContent("il y a 1 min");
  });

  it("pauses and resumes without losing the remaining time", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith(["Cuire 5 min."])} />);

    await user.click(screen.getByRole("button", { name: "⏱ 5 min" }));
    elapse(60_000);
    await waitFor(() =>
      expect(screen.getByTestId("cook-timer")).toHaveTextContent("04:00"),
    );

    await user.click(
      screen.getByRole("button", { name: "Mettre en pause le minuteur de l'étape 1" }),
    );
    elapse(120_000);
    // Paused means paused: two minutes of wall clock changed nothing. Given a
    // tick every half second, one second of waiting is three chances to fail.
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(screen.getByTestId("cook-timer")).toHaveTextContent("04:00");

    await user.click(
      screen.getByRole("button", { name: "Reprendre le minuteur de l'étape 1" }),
    );
    elapse(30_000);
    await waitFor(() =>
      expect(screen.getByTestId("cook-timer")).toHaveTextContent("03:30"),
    );
  });

  it("runs several at once, each naming its step", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <CookingMode recipe={recipeWith(["Cuire 5 min.", "Dorer 2 min."])} />,
    );

    await user.click(screen.getByRole("button", { name: "⏱ 5 min" }));
    await user.click(screen.getByRole("button", { name: /Suivante/ }));
    await user.click(screen.getByRole("button", { name: "⏱ 2 min" }));

    const running = screen.getAllByTestId("cook-timer");
    expect(running).toHaveLength(2);
    expect(running[0]).toHaveTextContent("Étape 1");
    expect(running[1]).toHaveTextContent("Étape 2");

    await user.click(
      screen.getByRole("button", { name: "Annuler le minuteur de l'étape 1" }),
    );
    expect(screen.getAllByTestId("cook-timer")).toHaveLength(1);
  });
});
