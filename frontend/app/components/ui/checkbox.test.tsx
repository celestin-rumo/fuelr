import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";

describe("Checkbox", () => {
  it("toggles through its label", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Avocats mûrs" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("Avocats mûrs"));

    expect(onChange).toHaveBeenCalledOnce();
  });

  it("reports a mixed state when indeterminate", () => {
    render(<Checkbox label="Partiel" indeterminate readOnly checked={false} />);

    expect(screen.getByLabelText("Partiel")).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
  });
});

describe("Switch", () => {
  it("exposes the switch role", () => {
    render(<Switch label="Partager le foyer" defaultChecked />);

    expect(screen.getByRole("switch", { name: "Partager le foyer" })).toBeChecked();
  });

  it("cannot be toggled when disabled", async () => {
    const onChange = vi.fn();
    render(<Switch label="Désactivé" disabled onChange={onChange} />);

    await userEvent.click(screen.getByRole("switch", { name: "Désactivé" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
