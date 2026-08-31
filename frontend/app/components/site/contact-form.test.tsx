import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { ContactForm } from "./contact-form";

describe("ContactForm", () => {
  it("refuses an empty submit and names the first missing field", async () => {
    renderWithIntl(<ContactForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Indique ton nom.");
  });

  it("rejects a malformed email", async () => {
    renderWithIntl(<ContactForm />);

    await userEvent.type(screen.getByLabelText("Nom"), "Camille");
    await userEvent.type(screen.getByLabelText("Email"), "camille@");
    await userEvent.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cet email ne ressemble pas à un email.",
    );
  });

  it("rejects a message under ten characters", async () => {
    renderWithIntl(<ContactForm />);

    await userEvent.type(screen.getByLabelText("Nom"), "Camille");
    await userEvent.type(screen.getByLabelText("Email"), "camille@fuelr.app");
    await userEvent.type(screen.getByLabelText("Message"), "court");
    await userEvent.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("un peu court");
  });

  it("confirms once a valid message is sent", async () => {
    renderWithIntl(<ContactForm />);

    await userEvent.type(screen.getByLabelText("Nom"), "Camille");
    await userEvent.type(screen.getByLabelText("Email"), "camille@fuelr.app");
    await userEvent.type(
      screen.getByLabelText("Message"),
      "Une idée de fonctionnalité pour le planning.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Message envoyé",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets the subject be changed", async () => {
    renderWithIntl(<ContactForm />);

    const bug = screen.getByRole("button", { name: "Un bug" });
    expect(bug).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(bug);

    expect(bug).toHaveAttribute("aria-pressed", "true");
  });
});
