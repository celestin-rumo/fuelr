import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { Recipe } from "@app/lib/api";
import { CookingMode } from "./cooking-mode";

function recipeWith(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 7,
    title: "Curry de lentilles corail",
    description: null,
    servings: 4,
    level: "easy",
    status: "PUBLISHED",
    hasPhoto: false,
    ingredients: [
      { id: 1, name: "Lentilles corail", quantity: 200, unit: "g", needsReview: false },
      { id: 2, name: "Lait de coco", quantity: 400, unit: "ml", needsReview: true },
    ],
    steps: ["Rincer les lentilles.", "Faire revenir l'oignon 5 min.", "Servir."],
    tags: [],
    sourceUrl: null,
    totalMinutes: null,
    unverified: [],
    ...overrides,
  };
}

describe("CookingMode", () => {
  it("shows one step at a time, and moves by one", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    expect(screen.getByTestId("cook-step")).toHaveTextContent("Rincer les lentilles.");
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 1 sur 3");

    await user.click(screen.getByRole("button", { name: /Suivante/ }));

    expect(screen.getByTestId("cook-step")).toHaveTextContent("Faire revenir l'oignon");
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 2 sur 3");
  });

  it("cannot go back from the first step", () => {
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    expect(screen.getByRole("button", { name: "Étape précédente" })).toBeDisabled();
  });

  it("offers finishing instead of a next step on the last one", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith({ steps: ["Servir."] })} />);

    expect(screen.queryByRole("button", { name: /Suivante/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terminer" })).toBeInTheDocument();

    // And the counter does not pretend there are more.
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 1 sur 1");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 1 sur 1");
  });

  it("skips the steps the editor left empty", () => {
    renderWithIntl(
      <CookingMode recipe={recipeWith({ steps: ["Rincer.", "  ", "Servir."] })} />,
    );

    // A blank card is a normal state in the editor; a blank screen is not a
    // step, so the count is two rather than three.
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 1 sur 2");
  });

  it("moves with the arrow keys", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 2 sur 3");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("cook-progress")).toHaveTextContent("Étape 1 sur 3");
  });

  it("opens the ingredients without leaving the step, and closes on Escape", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    const opener = screen.getByRole("button", { name: "Ingrédients" });
    await user.click(opener);

    const sheet = screen.getByTestId("cook-ingredients");
    expect(sheet).toHaveAttribute("data-open", "true");
    // Focus follows the sheet, so the next tab lands on an ingredient.
    expect(sheet).toHaveFocus();
    expect(screen.getByTestId("cook-step")).toHaveTextContent("Rincer les lentilles.");

    await user.keyboard("{Escape}");
    expect(sheet).toHaveAttribute("data-open", "false");
    expect(opener).toHaveFocus();
  });

  it("marks a quantity the import could not read", () => {
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    const marks = screen.getAllByTestId("cook-ingredient-review");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("À vérifier");
  });

  it("scales the quantities for tonight without touching the recipe", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    // Written for four; nothing says otherwise until it is changed.
    expect(screen.getByTestId("cook-servings")).toHaveTextContent("4 personnes");
    expect(screen.queryByTestId("cook-scaled-notice")).not.toBeInTheDocument();
    expect(screen.getByText(/^200\s+g$/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Une portion de plus" }));
    await user.click(screen.getByRole("button", { name: "Une portion de plus" }));

    expect(screen.getByTestId("cook-servings")).toHaveTextContent("6 personnes");
    expect(screen.getByText(/^300\s+g$/)).toBeInTheDocument();
    expect(screen.getByText(/^600\s+ml$/)).toBeInTheDocument();

    // And it says both figures, plus what it does not recalculate.
    const notice = screen.getByTestId("cook-scaled-notice");
    expect(notice).toHaveTextContent("La recette est pour 4 personnes");
    expect(notice).toHaveTextContent("ne sont pas recalculées");
  });

  it("stays inside the servings the editor allows", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith({ servings: 1 })} />);

    expect(screen.getByRole("button", { name: "Une portion de moins" })).toBeDisabled();

    const more = screen.getByRole("button", { name: "Une portion de plus" });
    for (let i = 0; i < 12; i += 1) await user.click(more);

    expect(screen.getByTestId("cook-servings")).toHaveTextContent("12 personnes");
    expect(more).toBeDisabled();
  });

  it("ticks an ingredient off without sending it anywhere", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CookingMode recipe={recipeWith()} />);

    const line = screen.getByRole("button", { name: /Lentilles corail/ });
    expect(line).toHaveAttribute("aria-pressed", "false");

    await user.click(line);
    expect(line).toHaveAttribute("aria-pressed", "true");
  });
});
