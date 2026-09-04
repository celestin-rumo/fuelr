import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Segmented, SegmentedCount } from "./segmented";

const OPTIONS = [
  { value: "monthly" as const, label: "Mensuel" },
  { value: "yearly" as const, label: "Annuel" },
];

describe("Segmented", () => {
  it("says which one is on, to assistive tech as well as to the eye", async () => {
    render(
      <Segmented
        label="Cycle"
        options={OPTIONS}
        value="yearly"
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("group", { name: "Cycle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Mensuel" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("draws the chosen one as a filled surface", () => {
    render(
      <Segmented
        label="Cycle"
        options={OPTIONS}
        value="monthly"
        onChange={() => {}}
      />,
    );
    // A tint behind a border reads as "on" only on a screen you are looking
    // straight at; the fill is what survives a worktop in daylight.
    expect(screen.getByRole("button", { name: "Mensuel" })).toHaveClass(
      "bg-accent",
    );
    expect(screen.getByRole("button", { name: "Annuel" })).not.toHaveClass(
      "bg-accent",
    );
  });

  it("reports the value that was chosen", async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Cycle"
        options={OPTIONS}
        value="monthly"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Annuel" }));
    expect(onChange).toHaveBeenCalledWith("yearly");
  });

  it("shows nothing as chosen when nothing has been", () => {
    // Not the same as the first one being chosen, and must not look like it.
    render(
      <Segmented
        label="Objectif"
        options={OPTIONS}
        value={undefined}
        onChange={() => {}}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button).not.toHaveClass("bg-accent");
    }
  });

  it("carries a count that inverts on the chosen segment", () => {
    render(
      <Segmented
        label="Filtrer"
        value="favorites"
        onChange={() => {}}
        options={[
          { value: "all" as const, label: "Toutes" },
          {
            value: "favorites" as const,
            label: "Favoris",
            affix: <SegmentedCount count={3} on />,
          },
        ]}
      />,
    );

    const count = screen.getByText("3");
    expect(count).toHaveClass("bg-on-accent");
    expect(count).not.toHaveClass("bg-accent");
  });
});
