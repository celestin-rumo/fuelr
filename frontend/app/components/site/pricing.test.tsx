import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { PlanPrices } from "@app/lib/api";
import { PricingPlans } from "./pricing";

const PRICES: PlanPrices = {
  currency: "CHF",
  openPeriod: false,
  canOrder: false,
  plans: [
    { tier: "FREE", monthly: 0, yearly: 0, features: [] },
    { tier: "PLUS", monthly: 6.9, yearly: 69, features: ["NUTRITION_TRACKING"] },
    { tier: "FAMILY", monthly: 11.9, yearly: 119, features: ["HOUSEHOLD_SHARING"] },
  ],
};

describe("PricingPlans", () => {
  it("starts on the monthly cycle", () => {
    renderWithIntl(<PricingPlans prices={PRICES} />);

    expect(screen.getByText("6,90")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mensuel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches every plan to the yearly price", async () => {
    renderWithIntl(<PricingPlans prices={PRICES} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Annuel/ }),
    );

    expect(screen.getByText("69")).toBeInTheDocument();
    expect(screen.getByText("119")).toBeInTheDocument();
    expect(screen.queryByText("6,90")).not.toBeInTheDocument();
  });

  it("formats a price the way the reader writes one", () => {
    renderWithIntl(<PricingPlans prices={PRICES} />);

    // Six ninety in French, and 69 rather than 69,00 — the backend says the
    // number, the locale says how it looks.
    expect(screen.getByText("6,90")).toBeInTheDocument();
    expect(screen.getByText("11,90")).toBeInTheDocument();
  });

  it("says the launch is open rather than showing crosses beside what works", () => {
    renderWithIntl(<PricingPlans prices={{ ...PRICES, openPeriod: true }} />);

    expect(screen.getByTestId("launch-banner")).toHaveTextContent(
      "accessibles à tout le monde",
    );
  });

  it("still sells when the backend has nothing to say about prices", () => {
    renderWithIntl(<PricingPlans prices={null} />);

    // No figures, and everything else: a pricing page with no answer from the
    // backend is worth more than a stack trace or an invented zero.
    expect(screen.getByRole("heading", { name: "Fuelr Plus" })).toBeInTheDocument();
    expect(screen.queryByText("6,90")).not.toBeInTheDocument();
  });

  it("renders the three plans with their CTA", () => {
    renderWithIntl(<PricingPlans prices={PRICES} />);

    for (const name of ["Cuisine", "Fuelr Plus", "Famille"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    // A link, not a button: choosing a plan navigates to sign-up. It was a
    // <Button> with no handler and did nothing at all.
    expect(
      screen.getByRole("link", { name: "Essayer 14 jours" }),
    ).toHaveAttribute("href", "/fr/inscription");
  });
});
