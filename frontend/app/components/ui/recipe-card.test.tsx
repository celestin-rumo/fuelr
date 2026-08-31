import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecipeCard } from "./recipe-card";
import { Badge } from "./badge";
import { EmptyState } from "./empty-state";

describe("RecipeCard", () => {
  it("renders its title, meta and data", () => {
    render(
      <RecipeCard
        title="Bowl quinoa & légumes rôtis"
        meta="4 personnes · 25 min"
        data="520 kcal · 600 g"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Bowl quinoa & légumes rôtis" }),
    ).toBeInTheDocument();
    expect(screen.getByText("520 kcal · 600 g")).toBeInTheDocument();
  });

  it("toggles the favourite control", async () => {
    const onToggleFavorite = vi.fn();
    render(
      <RecipeCard
        title="Curry"
        meta="6 personnes"
        onToggleFavorite={onToggleFavorite}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Add to favourites" }),
    );

    expect(onToggleFavorite).toHaveBeenCalledOnce();
  });

  it("takes an unavailable card out of interaction", () => {
    const { container } = render(
      <RecipeCard title="Wrap" meta="1 personne" unavailable />,
    );

    const article = container.querySelector("article");
    expect(article).toHaveAttribute("data-unavailable", "true");
    expect(article).toHaveClass("pointer-events-none");
  });
});

describe("Badge", () => {
  it("applies the requested tone", () => {
    render(<Badge tone="coral">Périmé</Badge>);

    expect(screen.getByText("Périmé")).toHaveClass("text-coral-ink");
  });
});

describe("EmptyState", () => {
  it("renders a title, body and action", () => {
    render(
      <EmptyState
        title="Ta liste est vide"
        body="Ajoute des recettes."
        action={<button type="button">Ouvrir</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Ta liste est vide" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir" })).toBeInTheDocument();
  });
});
