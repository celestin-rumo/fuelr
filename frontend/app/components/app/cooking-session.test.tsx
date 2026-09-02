import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { Recipe } from "@app/lib/api";
import { readSession, writeSession } from "@app/lib/cooking-session";
import { CookingMode } from "./cooking-mode";
import { CookingResumeBanner } from "./cooking-resume-banner";

function recipeWith(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 7,
    title: "Curry de lentilles corail",
    description: null,
    servings: 4,
    level: null,
    status: "PUBLISHED",
    hasPhoto: false,
    ingredients: [
      { id: 1, name: "Lentilles corail", quantity: 200, unit: "g", needsReview: false },
    ],
    steps: ["Rincer les lentilles.", "Faire revenir l'oignon.", "Servir."],
    tags: [],
    sourceUrl: null,
    totalMinutes: null,
    unverified: [],
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("the cooking session", () => {
  it("remembers the step, the servings and the ticked ingredients", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    await user.click(screen.getByRole("button", { name: /Suivante/ }));
    await user.click(screen.getByRole("button", { name: "Une portion de plus" }));
    await user.click(screen.getByRole("button", { name: /Lentilles corail/ }));

    const stored = readSession();
    expect(stored).toMatchObject({
      recipeId: 7,
      stepIndex: 1,
      stepCount: 3,
      servings: 5,
      ticked: [1],
    });
  });

  it("comes back where it was left", () => {
    writeSession({
      recipeId: 7,
      title: "Curry de lentilles corail",
      recipe: recipeWith(),
      stepIndex: 2,
      stepCount: 3,
      servings: 6,
      ticked: [1],
      timers: [],
      startedAt: Date.now() - 60_000,
    });

    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 3 sur 3");
    expect(screen.getByTestId("cook-servings")).toHaveTextContent("6 personnes");
    expect(screen.getByRole("button", { name: /Lentilles corail/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not resume a step the recipe no longer has", () => {
    // The recipe was edited down to two steps while the session sat there.
    writeSession({
      recipeId: 7,
      title: "Curry de lentilles corail",
      recipe: recipeWith(),
      stepIndex: 9,
      stepCount: 10,
      servings: 4,
      ticked: [],
      timers: [],
      startedAt: Date.now(),
    });

    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 3 sur 3");
  });

  it("drops a session older than twelve hours", () => {
    writeSession({
      recipeId: 7,
      title: "Curry",
      recipe: recipeWith(),
      stepIndex: 1,
      stepCount: 3,
      servings: 4,
      ticked: [],
      timers: [],
      startedAt: Date.now(),
    });
    // A stale resume prompt is worse than none.
    const raw = JSON.parse(window.localStorage.getItem("fuelr.cooking-session")!);
    window.localStorage.setItem(
      "fuelr.cooking-session",
      JSON.stringify({ ...raw, updatedAt: Date.now() - 13 * 60 * 60 * 1000 }),
    );

    expect(readSession()).toBeNull();
  });

  it("asks before taking over another dish, and stores nothing until it is settled", async () => {
    const user = userEvent.setup();
    writeSession({
      recipeId: 42,
      title: "Risotto",
      recipe: recipeWith({ id: 42, title: "Risotto" }),
      stepIndex: 2,
      stepCount: 5,
      servings: 2,
      ticked: [],
      timers: [],
      startedAt: Date.now(),
    });

    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    expect(screen.getByTestId("cook-conflict")).toHaveTextContent("Risotto");
    expect(screen.getByTestId("cook-conflict")).toHaveTextContent("étape 3 sur 5");

    // Moving through the steps must not quietly overwrite the other dish.
    await user.click(screen.getByRole("button", { name: /Suivante/ }));
    expect(readSession()?.recipeId).toBe(42);

    await user.click(screen.getByRole("button", { name: "Cuisiner celui-ci" }));
    expect(readSession()?.recipeId).toBe(7);
  });

  it("works with no storage at all", async () => {
    // A private window: reading throws, and the kitchen screen still opens.
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);
    await user.click(screen.getByRole("button", { name: /Suivante/ }));

    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 2 sur 3");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("finishing", () => {
  it("clears the session and offers to cook it again", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith({ steps: ["Servir."] })} />);

    await user.click(screen.getByTestId("cook-finish"));

    expect(screen.getByTestId("cook-elapsed")).toHaveTextContent("aux fourneaux");
    expect(readSession()).toBeNull();
    // Nothing here claims the meal was logged: there is no meal log yet.
    expect(screen.queryByText(/journal/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cuisiner à nouveau" }));
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 1 sur 1");
  });
});

describe("the resume banner", () => {
  it("says what is under way, and lets it go", async () => {
    const user = userEvent.setup();
    writeSession({
      recipeId: 42,
      title: "Risotto",
      recipe: recipeWith({ id: 42, title: "Risotto" }),
      stepIndex: 2,
      stepCount: 5,
      servings: 2,
      ticked: [],
      timers: [],
      startedAt: Date.now(),
    });

    renderWithIntl(<CookingResumeBanner />);

    const banner = await screen.findByTestId("cook-resume");
    expect(banner).toHaveTextContent("Risotto · étape 3 sur 5");
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute(
      "href",
      "/fr/app/recettes/42/cuisiner",
    );

    await user.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(screen.queryByTestId("cook-resume")).not.toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it("shows nothing when nothing is under way", () => {
    renderWithIntl(<CookingResumeBanner />);
    cleanup();

    expect(screen.queryByTestId("cook-resume")).not.toBeInTheDocument();
  });
});
