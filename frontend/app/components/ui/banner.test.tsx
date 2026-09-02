import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "./banner";

describe("Banner", () => {
  it("interrupts for an error and waits its turn otherwise", () => {
    const { rerender } = render(<Banner tone="error">Boum</Banner>);
    expect(screen.getByRole("alert")).toHaveTextContent("Boum");

    rerender(<Banner tone="success">Bravo</Banner>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a title and a body together", () => {
    render(
      <Banner tone="error" title="Impossible de se connecter">
        Réessaie dans un instant.
      </Banner>,
    );

    expect(screen.getByText("Impossible de se connecter")).toBeInTheDocument();
    expect(screen.getByText("Réessaie dans un instant.")).toBeInTheDocument();
  });

  it("offers no dismiss button unless it can do something", async () => {
    const { rerender } = render(<Banner>Rien à fermer</Banner>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    const onDismiss = vi.fn();
    rerender(
      <Banner onDismiss={onDismiss} dismissLabel="Fermer">
        À fermer
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps the dismiss button named when it shows only a glyph", () => {
    render(<Banner onDismiss={() => {}} dismissLabel="Fermer">Texte</Banner>);

    // The ✕ is aria-hidden, so without the label the button would have no
    // accessible name at all.
    expect(screen.getByRole("button")).toHaveAccessibleName("Fermer");
  });

  it("pins itself above the page only when asked", () => {
    const { rerender, container } = render(<Banner>Dans le flux</Banner>);
    expect(container.firstElementChild).not.toHaveClass("fixed");

    rerender(<Banner position="fixed">Au-dessus</Banner>);
    expect(container.firstElementChild).toHaveClass("fixed");
  });
});
