import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "./stepper";

function open(props: Partial<React.ComponentProps<typeof Stepper>> = {}) {
  const onChange = vi.fn();
  render(
    <Stepper
      value={4}
      onChange={onChange}
      decreaseLabel="Moins"
      increaseLabel="Plus"
      {...props}
    />,
  );
  return onChange;
}

describe("Stepper", () => {
  it("steps in both directions", async () => {
    const onChange = open();

    await userEvent.click(screen.getByRole("button", { name: "Plus" }));
    expect(onChange).toHaveBeenCalledWith(5);

    await userEvent.click(screen.getByRole("button", { name: "Moins" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("enforces its own bounds rather than trusting the caller", () => {
    // Four copies of this existed and they clamped in four places; one of them
    // clamped on the label and not on the click.
    const { unmount } = render(
      <Stepper
        value={1}
        onChange={() => {}}
        decreaseLabel="Moins"
        increaseLabel="Plus"
      />,
    );
    expect(screen.getByRole("button", { name: "Moins" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Plus" })).toBeEnabled();
    unmount();

    render(
      <Stepper
        value={12}
        max={12}
        onChange={() => {}}
        decreaseLabel="Moins"
        increaseLabel="Plus"
      />,
    );
    expect(screen.getByRole("button", { name: "Plus" })).toBeDisabled();
  });

  it("shows the figure, or what the caller makes of it", () => {
    const { unmount } = render(
      <Stepper
        value={4}
        onChange={() => {}}
        decreaseLabel="Moins"
        increaseLabel="Plus"
        data-testid="servings"
      />,
    );
    expect(screen.getByTestId("servings")).toHaveTextContent("4");
    unmount();

    render(
      <Stepper
        value={4}
        onChange={() => {}}
        decreaseLabel="Moins"
        increaseLabel="Plus"
        data-testid="servings"
      >
        4 personnes
      </Stepper>,
    );
    expect(screen.getByTestId("servings")).toHaveTextContent("4 personnes");
  });

  it("names both controls, because two icons say nothing on their own", () => {
    open();
    expect(screen.getByRole("button", { name: "Moins" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plus" })).toBeInTheDocument();
  });
});
