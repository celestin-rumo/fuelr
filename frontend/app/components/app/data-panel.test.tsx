import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { DataPanel } from "./data-panel";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }) }));
const requestExport = vi.fn(async () => ({ ok: true }));
const previewDeletion = vi.fn(async () => ({ recipes: 43, photos: 12, householdHandedOver: true, newOwnerEmail: "anna@fuelr.app" }));
const deleteAccount = vi.fn();
vi.mock("@app/[locale]/(app)/app/account/actions", () => ({
  requestExport: (...args: unknown[]) => requestExport(...(args as [])),
  previewDeletion: (...args: unknown[]) => previewDeletion(...(args as [])),
  deleteAccount: (...args: unknown[]) => deleteAccount(...(args as [])),
}));

beforeEach(() => vi.clearAllMocks());

it("asks for the archive and says where the link goes", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<DataPanel email="celine@fuelr.app" />);
  await user.click(screen.getByTestId("export-submit"));
  await waitFor(() => expect(requestExport).toHaveBeenCalledWith("fr"));
  expect(await screen.findByTestId("export-asked")).toHaveTextContent("celine@fuelr.app");
});

it("says what deleting will do from what the server reports, and asks for the password", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<DataPanel email="celine@fuelr.app" />);
  await user.click(screen.getByTestId("delete-open"));

  const dialog = await screen.findByTestId("delete-dialog");
  expect(within(dialog).getByText("Vos 43 recettes")).toBeInTheDocument();
  expect(within(dialog).getByText("12 photos")).toBeInTheDocument();
  expect(within(dialog).getByTestId("delete-handover")).toHaveTextContent("anna@fuelr.app");
  expect(within(dialog).getByTestId("delete-confirm")).toBeDisabled();
  expect(deleteAccount).not.toHaveBeenCalled();
});

it("keeps the account when the password is wrong", async () => {
  const user = userEvent.setup({ delay: null });
  deleteAccount.mockResolvedValueOnce({ ok: false, reason: "wrong" });
  renderWithIntl(<DataPanel email="celine@fuelr.app" />);
  await user.click(screen.getByTestId("delete-open"));
  await screen.findByTestId("delete-dialog");
  await user.type(screen.getByTestId("delete-password"), "pasdutout");
  await user.click(screen.getByTestId("delete-confirm"));

  expect(await screen.findByText("Ce n'est pas votre mot de passe.")).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
