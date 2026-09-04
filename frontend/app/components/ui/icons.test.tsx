import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "./icons";

describe("Icon", () => {
  it("is decorative: the control around it carries the name", () => {
    const { container } = render(<Icon name="trash" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // Not a tab stop in Internet Explorer's descendants, and not an image
    // announced next to the label of the button holding it.
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg.querySelector("path")).toBeInTheDocument();
  });

  it("takes its colour from the control it sits in", () => {
    const { container } = render(<Icon name="pencil" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
  });

  it("fills the shape when the state is on", () => {
    // The pinned star is filled; the unpinned one is the same outline.
    const { container } = render(<Icon name="star" filled />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );
  });

  it("draws every icon on the same grid", () => {
    const { container } = render(
      <>
        <Icon name="arrowUp" />
        <Icon name="copy" />
        <Icon name="cart" />
      </>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      expect(svg).toHaveAttribute("stroke-width", "1.7");
    }
  });

  it("sizes in pixels, so a rail of icons lines up", () => {
    const { container } = render(<Icon name="check" size={20} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
  });
});
