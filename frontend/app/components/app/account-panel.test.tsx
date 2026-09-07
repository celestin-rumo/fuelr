import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { Session } from "@app/lib/session";
import type { ProfileResponse } from "@app/lib/api";
import { AccountPanel } from "./account-panel";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
}));

const updateAccount = vi.fn(async () => ({ ok: true }));
const changePassword = vi.fn();
const requestEmailChange = vi.fn();
const saveProfile = vi.fn();
const previewTargets = vi.fn(async () => ({ kcal: 2100, proteinG: 120, carbsG: 240, fatG: 70 }));

vi.mock("@app/[locale]/(app)/app/account/actions", () => ({
  updateAccount: (...args: unknown[]) => updateAccount(...(args as [])),
  changePassword: (...args: unknown[]) => changePassword(...(args as [])),
  requestEmailChange: (...args: unknown[]) => requestEmailChange(...(args as [])),
  saveProfile: (...args: unknown[]) => saveProfile(...(args as [])),
  previewTargets: (...args: unknown[]) => previewTargets(...(args as [])),
}));

const session: Session = {
  id: 1,
  email: "celine@fuelr.app",
  name: "Céline",
  role: "USER",
  emailVerified: true,
  locale: "fr",
};

const profile: ProfileResponse = {
  profile: { age: 34, sex: "FEMALE", heightCm: 168, weightKg: 62, activity: "MODERATE", goal: "MAINTAIN" },
  targets: { kcal: 2000, proteinG: 110, carbsG: 230, fatG: 65 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

it("saves the name on its own, without a save button", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<AccountPanel session={session} profile={profile} />);

  const name = screen.getByTestId("account-name");
  await user.clear(name);
  await user.type(name, "Camille{Enter}");

  await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({ name: "Camille" }));
  expect(await screen.findByTestId("account-notice")).toHaveTextContent("Enregistré.");
});

it("never pre-fills a password", () => {
  renderWithIntl(<AccountPanel session={session} profile={profile} />);

  expect(screen.getByTestId("password-current")).toHaveValue("");
  expect(screen.getByTestId("password-next")).toHaveValue("");
  expect(screen.getByTestId("email-password")).toHaveValue("");
});

it("says which password was wrong, and keeps the form", async () => {
  const user = userEvent.setup({ delay: null });
  changePassword.mockResolvedValueOnce({ ok: false, reason: "wrong" });
  renderWithIntl(<AccountPanel session={session} profile={profile} />);

  await user.type(screen.getByTestId("password-current"), "pasdutout");
  await user.type(screen.getByTestId("password-next"), "nouveaumotdepasse");
  await user.click(screen.getByTestId("password-submit"));

  expect(await screen.findByText("Ce n'est pas votre mot de passe actuel.")).toBeInTheDocument();
  // Nothing was thrown away: the person corrects one field, not three.
  expect(screen.getByTestId("password-next")).toHaveValue("nouveaumotdepasse");
});

it("says the other devices are out once the password changed", async () => {
  const user = userEvent.setup({ delay: null });
  changePassword.mockResolvedValueOnce({ ok: true });
  renderWithIntl(<AccountPanel session={session} profile={profile} />);

  await user.type(screen.getByTestId("password-current"), "motdepasse123");
  await user.type(screen.getByTestId("password-next"), "nouveaumotdepasse");
  await user.click(screen.getByTestId("password-submit"));

  expect(await screen.findByTestId("account-notice")).toHaveTextContent(/autres appareils/);
  expect(screen.getByTestId("password-current")).toHaveValue("");
});

it("asks for a click before an address moves, and says the old one was told", async () => {
  const user = userEvent.setup({ delay: null });
  requestEmailChange.mockResolvedValueOnce({ ok: true });
  renderWithIntl(<AccountPanel session={session} profile={profile} />);

  await user.type(screen.getByTestId("email-new"), "nouvelle@fuelr.app");
  await user.type(screen.getByTestId("email-password"), "motdepasse123");
  await user.click(screen.getByTestId("email-submit"));

  const sent = await screen.findByTestId("email-change-sent");
  expect(sent).toHaveTextContent("nouvelle@fuelr.app");
  expect(sent).toHaveTextContent(/l'ancienne adresse reste la vôtre/);
  // Still the old address on screen: nothing moved.
  expect(screen.getByTestId("account-email")).toHaveTextContent("celine@fuelr.app");
});

it("previews the target before writing the figures, and only then offers to save", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<AccountPanel session={session} profile={profile} />);

  expect(screen.getByTestId("figures-submit")).toBeDisabled();
  expect(screen.getByTestId("target-preview")).toHaveTextContent("2000");

  const weight = screen.getByTestId("figure-weight");
  await user.clear(weight);
  await user.type(weight, "60");

  await waitFor(() => expect(previewTargets).toHaveBeenCalled());
  expect(await screen.findByText("2100")).toBeInTheDocument();
  expect(saveProfile).not.toHaveBeenCalled();
  expect(screen.getByTestId("figures-submit")).toBeEnabled();
});

it("treats a missing profile as a state, not an error", () => {
  renderWithIntl(<AccountPanel session={session} profile={null} />);

  expect(screen.getByText(/Aucun profil pour l'instant/)).toBeInTheDocument();
  expect(screen.queryByTestId("target-preview")).not.toBeInTheDocument();
});
