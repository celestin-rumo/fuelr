import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";

/*
 * What a dialog owes: a name, a way out that is not the button, and focus that
 * has moved into it. Whether its bottom can be reached on a 360×480 screen is
 * geometry, and geometry is asserted in `e2e/mobile-360.spec.ts` — jsdom loads
 * no stylesheet, so a class list here would prove nothing about layout.
 */
describe("Dialog", () => {
  function open(onClose = vi.fn()) {
    render(
      <Dialog title="Retirer du planning ?" closeLabel="Fermer" onClose={onClose}>
        <p>Le repas de mardi soir.</p>
      </Dialog>,
    );
    return onClose;
  }

  it("is a modal that carries its title as its name", () => {
    open();

    const dialog = screen.getByRole("dialog", { name: "Retirer du planning ?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Le repas de mardi soir.")).toBeInTheDocument();
  });

  it("closes on Escape, without anything focused first", async () => {
    const user = userEvent.setup();
    const onClose = open();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button, which says what it does", async () => {
    const user = userEvent.setup();
    const onClose = open();

    await user.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("takes focus, so Escape and Tab land inside it", () => {
    open();

    expect(screen.getByRole("button", { name: "Fermer" })).toHaveFocus();
  });

  it("stops listening for Escape once it is gone", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog title="Titre" closeLabel="Fermer" onClose={onClose}>
        <p>Corps</p>
      </Dialog>,
    );

    unmount();
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
