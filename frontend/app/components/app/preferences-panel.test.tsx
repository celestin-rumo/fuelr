import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { DietaryPreferences } from "@app/lib/api";
import { PreferencesPanel } from "./preferences-panel";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const savePreferences = vi.fn(async (input: DietaryPreferences) => ({ ok: true as const, saved: input }));
vi.mock("@app/[locale]/(app)/app/account/actions", () => ({
  savePreferences: (...args: unknown[]) => savePreferences(...(args as [DietaryPreferences])),
}));

const none: DietaryPreferences = { diet: "NONE", allergens: [], dislikes: null };

beforeEach(() => vi.clearAllMocks());

it("offers the fourteen allergens as chips and a closed list for the diet", () => {
  renderWithIntl(<PreferencesPanel preferences={none} />);

  expect(screen.getByTestId("allergen-chips").querySelectorAll("button")).toHaveLength(14);
  expect(screen.getByRole("button", { name: "Végétarien" })).toBeInTheDocument();
  expect(screen.getByTestId("preferences-submit")).toBeDisabled();
});

it("saves the two closed lists and the free line, whole", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<PreferencesPanel preferences={none} />);

  await user.click(screen.getByRole("button", { name: "Végétarien" }));
  await user.click(screen.getByRole("button", { name: "Arachides" }));
  await user.click(screen.getByRole("button", { name: "Sésame" }));
  await user.type(screen.getByTestId("dislikes"), "pas de coriandre");
  await user.click(screen.getByTestId("preferences-submit"));

  await waitFor(() =>
    expect(savePreferences).toHaveBeenCalledWith({
      diet: "VEGETARIAN",
      allergens: ["PEANUTS", "SESAME"],
      dislikes: "pas de coriandre",
    }),
  );
  expect(await screen.findByTestId("preferences-notice")).toHaveTextContent("enregistrées");
});

it("says where an allergy goes, and that the free line is only a remark", () => {
  renderWithIntl(<PreferencesPanel preferences={none} />);

  // The one sentence that keeps somebody from typing "no peanuts" where it
  // would not protect them.
  expect(screen.getByText(/Une allergie va dans les cases au-dessus/)).toBeInTheDocument();
  expect(screen.getByText(/écarté par le code/)).toBeInTheDocument();
});

it("unticks an allergen it was given", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<PreferencesPanel preferences={{ diet: "NONE", allergens: ["MILK"], dislikes: null }} />);

  const milk = screen.getByRole("button", { name: "Lait" });
  expect(milk).toHaveAttribute("aria-pressed", "true");
  await user.click(milk);
  await user.click(screen.getByTestId("preferences-submit"));

  await waitFor(() =>
    expect(savePreferences).toHaveBeenCalledWith({ diet: "NONE", allergens: [], dislikes: null }),
  );
});
