import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListRow, ListRowActions, ListRowMeta, ListRowTitle } from "./list-row";

describe("ListRow", () => {
  it("renders its three slots in order", () => {
    render(
      <ListRow
        leading={<span data-testid="lead">★</span>}
        trailing={<span data-testid="trail">400 g</span>}
      >
        <ListRowTitle>Lentilles corail</ListRowTitle>
        <ListRowMeta>Épicerie</ListRowMeta>
      </ListRow>,
    );

    expect(screen.getByTestId("lead")).toBeInTheDocument();
    expect(screen.getByText("Lentilles corail")).toBeInTheDocument();
    expect(screen.getByText("Épicerie")).toBeInTheDocument();
    expect(screen.getByTestId("trail")).toBeInTheDocument();
  });

  it("is a list item when the list is made of rows", () => {
    render(
      <ul>
        <ListRow as="li">
          <ListRowTitle>Soupe de courge</ListRowTitle>
        </ListRow>
      </ul>,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("Soupe de courge");
  });

  it("carries the accent border only when selected", () => {
    const { rerender } = render(
      <ListRow data-testid="row">
        <ListRowTitle>Curry</ListRowTitle>
      </ListRow>,
    );
    expect(screen.getByTestId("row")).toHaveClass("border-line");

    rerender(
      <ListRow data-testid="row" selected>
        <ListRowTitle>Curry</ListRowTitle>
      </ListRow>,
    );
    const row = screen.getByTestId("row");
    expect(row).toHaveClass("border-accent-ink");
    // One border colour, not two competing utilities.
    expect(row).not.toHaveClass("border-line");
  });

  it("keeps a control that does not apply in place rather than removing it", () => {
    // The whole point of the rail: two neighbouring rows put "delete" in the
    // same place, whether or not the row above can be reordered.
    render(
      <ListRow
        trailing={
          <ListRowActions>
            <button type="button" disabled aria-label="Monter">
              ↑
            </button>
            <button type="button" aria-label="Supprimer">
              ✕
            </button>
          </ListRowActions>
        }
      >
        <ListRowTitle>Curry</ListRowTitle>
      </ListRow>,
    );

    const controls = screen.getAllByRole("button");
    expect(controls).toHaveLength(2);
    expect(controls[0]).toBeDisabled();
  });

  it("merges a caller's classes last", () => {
    render(
      <ListRow data-testid="row" className="mt-8">
        <ListRowTitle>Curry</ListRowTitle>
      </ListRow>,
    );
    expect(screen.getByTestId("row")).toHaveClass("mt-8");
  });
});
