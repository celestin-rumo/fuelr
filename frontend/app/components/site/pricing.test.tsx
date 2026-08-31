import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { PricingPlans } from "./pricing";

describe("PricingPlans", () => {
  it("starts on the monthly cycle", () => {
    renderWithIntl(<PricingPlans />);

    expect(screen.getByText("6,90")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mensuel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches every plan to the yearly price", async () => {
    renderWithIntl(<PricingPlans />);

    await userEvent.click(
      screen.getByRole("button", { name: /Annuel/ }),
    );

    expect(screen.getByText("69")).toBeInTheDocument();
    expect(screen.getByText("119")).toBeInTheDocument();
    expect(screen.queryByText("6,90")).not.toBeInTheDocument();
  });

  it("renders the three plans with their CTA", () => {
    renderWithIntl(<PricingPlans />);

    for (const name of ["Cuisine", "Fuelr Plus", "Famille"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Essayer 14 jours" }),
    ).toBeInTheDocument();
  });
});
