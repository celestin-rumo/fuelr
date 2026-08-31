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
    expect(card).toHaveClass("border-border");
  });
});
