import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardBody, CardTitle } from "./card";

describe("Card", () => {
  it("renders a title and body", () => {
    render(
      <Card>
        <CardTitle>Next steps</CardTitle>
        <CardBody>Add a route.</CardBody>
      </Card>,
    );

    expect(
      screen.getByRole("heading", { name: "Next steps" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Add a route.")).toBeInTheDocument();
  });

  it("keeps caller-supplied classes alongside its own", () => {
    render(<Card data-testid="card" className="mt-4" />);

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("mt-4");
    expect(card).toHaveClass("border-line");
  });

  it("uses the large radius for panels and the medium one for cards", () => {
    render(
      <>
        <Card data-testid="card" />
        <Card data-testid="panel" as="panel" />
      </>,
    );

    expect(screen.getByTestId("card")).toHaveClass("rounded-md");
    expect(screen.getByTestId("panel")).toHaveClass("rounded-lg");
  });

  it("marks a selected card with the accent border", () => {
    render(<Card data-testid="card" selected />);

    expect(screen.getByTestId("card")).toHaveClass("border-accent-ink");
    expect(screen.getByTestId("card")).not.toHaveClass("border-line");
  });
});
