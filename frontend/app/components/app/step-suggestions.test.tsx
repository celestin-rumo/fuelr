import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { StepTextarea, slashQuery } from "./step-suggestions";

describe("slashQuery", () => {
  it("opens on a slash at the start of the field or after a space", () => {
    expect(slashQuery("/mix", 4)).toEqual({ start: 0, query: "mix" });
    expect(slashQuery("Puis /pét", 9)).toEqual({ start: 5, query: "pét" });
  });

  /** The case the convention breaks on, and the one people meet first. */
  it("leaves a fraction alone", () => {
    expect(slashQuery("1/2 citron", 3)).toBeNull();
    expect(slashQuery("Ajouter 1/2 citron", 11)).toBeNull();
    // Including while it is still being typed.
    expect(slashQuery("1/", 2)).toBeNull();
  });

  it("closes again once the word is over", () => {
    expect(slashQuery("/mix ", 5)).toBeNull();
    expect(slashQuery("/mix puis remuer", 16)).toBeNull();
  });

  it("finds nothing where there is no slash", () => {
    expect(slashQuery("Faire revenir l'oignon", 22)).toBeNull();
  });
});

/**
 * The field is controlled, so the harness has to hold its value in state —
 * a closure over a local variable never re-renders, and the second keystroke
 * lands in a field React has just reset.
 */
function Harness({ onChange }: { onChange: (next: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <StepTextarea
      label="Étape 1"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function renderField() {
  const onChange = vi.fn();
  const view = renderWithIntl(<Harness onChange={onChange} />);
  return { onChange, view };
}

describe("StepTextarea", () => {
  it("offers ready-made steps as the query narrows", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByLabelText("Étape 1"));
    await user.keyboard("/");
    expect(await screen.findByTestId("step-suggestions")).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(5);
  });

  it("never opens on a fraction", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByLabelText("Étape 1"));
    await user.keyboard("1/2 citron");

    expect(screen.queryByTestId("step-suggestions")).not.toBeInTheDocument();
  });

  it("inserts editable text, not a frozen block", async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    await user.click(screen.getByLabelText("Étape 1"));
    await user.keyboard("/prech");
    await waitFor(() => expect(screen.getByTestId("step-suggestions")).toBeVisible());
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("Préchauffer le four à 180 °C."),
    );
    // Plain text in the field: the temperature is corrected like anything else.
    expect(screen.getByLabelText("Étape 1")).toHaveValue(
      "Préchauffer le four à 180 °C.",
    );
  });

  it("walks the list with the arrows", async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    await user.click(screen.getByLabelText("Étape 1"));
    await user.keyboard("/");
    await waitFor(() => expect(screen.getByTestId("step-suggestions")).toBeVisible());
    const first = screen.getAllByRole("option")[0].textContent;
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    // The second one, not the first.
    expect(onChange.mock.lastCall?.[0]).not.toBe(first);
  });

  it("closes on Escape without inserting anything", async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    await user.click(screen.getByLabelText("Étape 1"));
    await user.keyboard("/mix");
    await waitFor(() => expect(screen.getByTestId("step-suggestions")).toBeVisible());
    await user.keyboard("{Escape}");

    expect(screen.queryByTestId("step-suggestions")).not.toBeInTheDocument();
    // The slash that was typed stays typed.
    expect(onChange.mock.lastCall?.[0]).toBe("/mix");
  });

  it("says nothing when the query matches nothing", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByLabelText("Étape 1"));
    await user.keyboard("/zzzz");

    expect(screen.queryByTestId("step-suggestions")).not.toBeInTheDocument();
  });
});
