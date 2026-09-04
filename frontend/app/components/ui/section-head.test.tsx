import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHead } from "./section-head";

describe("SectionHead", () => {
  it("is a heading, at the level the page says", () => {
    render(<SectionHead as="h3">Repas notés</SectionHead>);
    expect(
      screen.getByRole("heading", { level: 3, name: "Repas notés" }),
    ).toBeInTheDocument();
  });

  it("defaults to h2", () => {
    render(<SectionHead>Courses</SectionHead>);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("keeps the block's action beside the block", () => {
    // The criterion is guidance: what a block can do belongs next to it, so
    // nothing has to be looked for further down the page.
    render(
      <SectionHead action={<a href="#history">Tout l&apos;historique</a>}>
        Repas notés
      </SectionHead>,
    );
    expect(
      screen.getByRole("link", { name: "Tout l'historique" }),
    ).toBeInTheDocument();
  });

  it("renders no action slot when there is no action", () => {
    const { container } = render(<SectionHead>Courses</SectionHead>);
    expect(container.querySelectorAll("div")).toHaveLength(2);
  });

  it("carries a hint under the title", () => {
    render(<SectionHead hint="Sur les sept derniers jours">Énergie</SectionHead>);
    expect(screen.getByText("Sur les sept derniers jours")).toBeInTheDocument();
  });
});
