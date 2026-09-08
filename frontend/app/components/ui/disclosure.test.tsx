import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Disclosure } from "./disclosure";

it("is shut until opened, and is a real details element", async () => {
  const user = userEvent.setup({ delay: null });
  render(
    <Disclosure title="Vos chiffres" hint="Six figures">
      <p>inside</p>
    </Disclosure>,
  );
  const details = screen.getByText("Vos chiffres").closest("details")!;
  expect(details).not.toHaveAttribute("open");

  await user.click(screen.getByText("Vos chiffres"));
  expect(details).toHaveAttribute("open");
});

it("can start open, for the block somebody came for", () => {
  render(
    <Disclosure title="Vous" defaultOpen>
      <p>inside</p>
    </Disclosure>,
  );
  expect(screen.getByText("Vous").closest("details")).toHaveAttribute("open");
});
