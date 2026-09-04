import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./pagination";

const LABELS = {
  nav: "Pages",
  previous: "Page précédente",
  next: "Page suivante",
  position: "Page 2 sur 3 · 14 recettes",
};

describe("Pagination", () => {
  it("moves in both directions", async () => {
    const onChange = vi.fn();
    render(
      <Pagination page={1} pages={3} onChange={onChange} labels={LABELS} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(onChange).toHaveBeenCalledWith(2);

    await userEvent.click(screen.getByRole("button", { name: "Page précédente" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("says there is nowhere further to go, rather than doing nothing", () => {
    const { unmount } = render(
      <Pagination page={0} pages={3} onChange={() => {}} labels={LABELS} />,
    );
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeEnabled();
    unmount();

    render(<Pagination page={2} pages={3} onChange={() => {}} labels={LABELS} />);
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
  });

  it("announces where you are when it changes", () => {
    // Pressing "next" moves rows somebody cannot see; this line is the only
    // feedback a screen reader gets.
    render(<Pagination page={1} pages={3} onChange={() => {}} labels={LABELS} />);
    const position = screen.getByText("Page 2 sur 3 · 14 recettes");
    expect(position).toHaveAttribute("aria-live", "polite");
  });

  it("is a named landmark, not a loose pair of buttons", () => {
    render(<Pagination page={1} pages={3} onChange={() => {}} labels={LABELS} />);
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeInTheDocument();
  });
});
