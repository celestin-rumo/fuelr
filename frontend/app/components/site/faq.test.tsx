import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Faq } from "./faq";
import { FeatureCard } from "./feature-card";

const items = [
  { question: "Première question ?", answer: "Première réponse." },
  { question: "Deuxième question ?", answer: "Deuxième réponse." },
];

describe("Faq", () => {
  it("opens the first panel by default", () => {
    render(<Faq items={items} />);

    expect(screen.getByText("Première réponse.")).toBeInTheDocument();
    expect(screen.queryByText("Deuxième réponse.")).not.toBeInTheDocument();
  });

  it("keeps a single panel open at a time", async () => {
    render(<Faq items={items} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Deuxième question/ }),
    );

    expect(screen.getByText("Deuxième réponse.")).toBeInTheDocument();
    expect(screen.queryByText("Première réponse.")).not.toBeInTheDocument();
  });

  it("closes the open panel when clicked again", async () => {
    render(<Faq items={items} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Première question/ }),
    );

    expect(screen.queryByText("Première réponse.")).not.toBeInTheDocument();
  });
});

describe("FeatureCard", () => {
  it("renders its icon, title, text and meta", () => {
    render(
      <FeatureCard
        icon="◷"
        title="Éditeur de recette"
        text="Titre, photo, portions."
        meta="création · 3 min"
        tone="mint"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Éditeur de recette" }),
    ).toBeInTheDocument();
    expect(screen.getByText("création · 3 min")).toBeInTheDocument();
  });
});
