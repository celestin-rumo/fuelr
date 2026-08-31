import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Chip } from "./chip";

describe("Chip", () => {
  it("exposes its active state to assistive tech", () => {
    render(<Chip active>Végétarien</Chip>);

    expect(screen.getByRole("button", { name: "Végétarien" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a count affix", () => {
    render(
      <Chip active count={3}>
        Protéines
      </Chip>,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("gives a removable chip a separate remove control", async () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(
      <Chip active onClick={onClick} onRemove={onRemove}>
        Moins de 20 min
      </Chip>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledOnce();
    // Removing must not also toggle the filter.
    expect(onClick).not.toHaveBeenCalled();
  });
});
