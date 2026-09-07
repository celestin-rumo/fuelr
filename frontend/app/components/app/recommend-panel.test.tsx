import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { RecommendPanel } from "./recommend-panel";

it("shows the link, a message that carries it, and a count that names nobody", () => {
  renderWithIntl(
    <RecommendPanel referral={{ code: "abc123def456", link: "https://fuelr.test/?via=abc123def456", referred: 2 }} />,
  );
  expect(screen.getByTestId("referral-link")).toHaveTextContent("?via=abc123def456");
  expect((screen.getByTestId("referral-message") as HTMLInputElement).value).toContain("?via=abc123def456");
  expect(screen.getByTestId("referral-count")).toHaveTextContent("2 personnes");
  // No promise: nothing is paid for, so nothing is offered.
  expect(screen.getByText(/pas avant/)).toBeInTheDocument();
});
