import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("ties the label to the field", () => {
    render(<Input label="Objectif calorique" defaultValue="2 000 kcal" />);

    expect(screen.getByLabelText("Objectif calorique")).toHaveValue(
      "2 000 kcal",
    );
  });

  it("marks an error field invalid and links its hint", () => {
    render(<Input label="Email" status="error" hint="Adresse incomplète" />);

    const field = screen.getByLabelText("Email");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Adresse incomplète");
  });

  it("does not mark a success field invalid", () => {
    render(<Input label="Code foyer" status="success" hint="Foyer rejoint" />);

    expect(screen.getByLabelText("Code foyer")).not.toHaveAttribute(
      "aria-invalid",
    );
  });
});
