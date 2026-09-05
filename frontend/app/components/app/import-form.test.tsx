import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { ImportSource } from "@app/lib/api";
import { ImportForm } from "./import-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

function sources(overrides: Partial<Record<ImportSource["source"], ImportSource>> = {}) {
  const base: ImportSource[] = [
    { source: "URL", state: "OPEN", requiredTier: null },
    { source: "PHOTO", state: "PLAN", requiredTier: "PLUS" },
    { source: "SCREENSHOT", state: "PLAN", requiredTier: "PLUS" },
  ];
  return base.map((one) => overrides[one.source] ?? one);
}

describe("ImportForm", () => {
  it("opens on the link, which is the one that is always free", () => {
    renderWithIntl(<ImportForm sources={sources()} />);

    expect(screen.getByLabelText("Lien de la recette")).toBeInTheDocument();
    expect(screen.getByTestId("source-URL")).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the three ways in, whatever their state", () => {
    renderWithIntl(<ImportForm sources={sources()} />);

    for (const label of ["Un lien", "Une photo", "Une capture d'écran"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("says what a photo import costs instead of offering a dead button", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ImportForm sources={sources()} />);

    await user.click(screen.getByTestId("source-PHOTO"));

    // Named, and priced: the reason somebody can act on says what to do. This
    // is the shape once the paid boundary is switched on; while nothing is
    // charged the same source comes back OPEN — see the case below.
    expect(screen.getByTestId("import-closed-PLAN")).toHaveTextContent("plan PLUS");
    expect(screen.queryByRole("button", { name: "Choisir un fichier" })).not.toBeInTheDocument();
  });

  it("names the gift when an assisted source is open and nothing is charged", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ImportForm
        openPeriod
        sources={sources({
          PHOTO: { source: "PHOTO", state: "OPEN", requiredTier: null },
        })}
      />,
    );

    await user.click(screen.getByTestId("source-PHOTO"));

    expect(screen.getByRole("button", { name: "Choisir un fichier" })).toBeInTheDocument();
    expect(screen.getByTestId("launch-note")).toHaveTextContent(
      "Offert pendant le lancement",
    );
  });

  it("tells a subscriber that nothing is wired, which is on us and not on them", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ImportForm
        sources={sources({
          PHOTO: { source: "PHOTO", state: "SOON", requiredTier: null },
        })}
      />,
    );

    await user.click(screen.getByTestId("source-PHOTO"));

    expect(screen.getByTestId("import-closed-SOON")).toHaveTextContent(
      "Pas encore branché",
    );
  });

  it("asks for images once the source is open, and says what fits", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ImportForm
        sources={sources({
          SCREENSHOT: { source: "SCREENSHOT", state: "OPEN", requiredTier: null },
        })}
      />,
    );

    await user.click(screen.getByTestId("source-SCREENSHOT"));

    expect(screen.getByRole("button", { name: "Choisir un fichier" })).toBeInTheDocument();
    // The advice differs by source: framing a book page is not framing a story.
    expect(screen.getByText(/capture d'une autre application/)).toBeInTheDocument();
  });

  it("refuses to send nothing", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithIntl(
      <ImportForm
        sources={sources({
          PHOTO: { source: "PHOTO", state: "OPEN", requiredTier: null },
        })}
      />,
    );

    await user.click(screen.getByTestId("source-PHOTO"));
    await user.click(screen.getByRole("button", { name: "Lire la recette" }));

    expect(screen.getByTestId("import-error")).toHaveTextContent("Aucune photo choisie");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
