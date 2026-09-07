import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { ProfileInput, WeightView } from "@app/lib/api";
import { WeightPanel } from "./weight-panel";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const recordWeight = vi.fn(async () => ({ ok: true as const, entry: { id: 9, weighedOn: "2026-03-09", weightKg: 61.8 } }));
const removeWeight = vi.fn(async () => ({ ok: true }));
const saveProfile = vi.fn(async () => ({ ok: true as const, saved: {} }));

vi.mock("@app/[locale]/(app)/app/account/actions", () => ({
  recordWeight: (...args: unknown[]) => recordWeight(...(args as [])),
  removeWeight: (...args: unknown[]) => removeWeight(...(args as [])),
  saveProfile: (...args: unknown[]) => saveProfile(...(args as [])),
}));

const TODAY = "2026-03-09";
const profile: ProfileInput = { age: 34, sex: "FEMALE", heightCm: 168, weightKg: 62, activity: "MODERATE", goal: "MAINTAIN" };

function view(overrides: Partial<WeightView> = {}): WeightView {
  return {
    entries: [
      { id: 1, weighedOn: "2026-03-02", weightKg: 62.4 },
      { id: 2, weighedOn: "2026-03-09", weightKg: 62.0 },
    ],
    latest: { id: 2, weighedOn: "2026-03-09", weightKg: 62.0 },
    profileWeightKg: 62,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

it("logs a figure for a day, and nothing else", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<WeightPanel weight={view()} profile={profile} today={TODAY} />);

  await user.type(screen.getByTestId("weight-kg"), "61.8");
  await user.click(screen.getByTestId("weight-submit"));

  await waitFor(() => expect(recordWeight).toHaveBeenCalledWith({ weighedOn: TODAY, weightKg: 61.8 }));
  // A figure and its date. No verdict anywhere on the card.
  expect(screen.getByText(/n'en tire aucune conclusion/)).toBeInTheDocument();
  expect(screen.queryByText(/bravo|série|streak/i)).not.toBeInTheDocument();
});

it("refuses a weight outside any human range before asking the server", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<WeightPanel weight={view()} profile={profile} today={TODAY} />);

  const kg = screen.getByTestId("weight-kg");
  await user.type(kg, "7");
  await user.click(screen.getByTestId("weight-submit"));

  // The field carries its own bounds, so the browser stops the submit before
  // any handler runs — which is exactly what jsdom does too. Either way the
  // server is never asked about a seven-kilo person.
  expect(kg).toBeInvalid();
  expect(recordWeight).not.toHaveBeenCalled();
});

it("offers to recompute the target only once the weight has drifted, and never applies it alone", async () => {
  const user = userEvent.setup({ delay: null });
  const { unmount } = renderWithIntl(<WeightPanel weight={view()} profile={profile} today={TODAY} />);
  // 62.0 against a profile at 62: not worth a new target.
  expect(screen.queryByTestId("weight-recompute")).not.toBeInTheDocument();
  unmount();

  renderWithIntl(
    <WeightPanel
      weight={view({ latest: { id: 3, weighedOn: TODAY, weightKg: 58 } })}
      profile={profile}
      today={TODAY}
    />,
  );
  const offer = screen.getByTestId("weight-recompute");
  expect(offer).toHaveTextContent("58");
  expect(offer).toHaveTextContent("62");
  expect(saveProfile).not.toHaveBeenCalled();

  await user.click(within(offer).getByRole("button"));
  await waitFor(() => expect(saveProfile).toHaveBeenCalledWith({ ...profile, weightKg: 58 }));
});

it("removes a weigh-in without asking, and offers to undo", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<WeightPanel weight={view()} profile={profile} today={TODAY} />);

  await user.click(screen.getByTestId("weight-remove-1"));
  await waitFor(() => expect(removeWeight).toHaveBeenCalledWith(1));

  await user.click(await screen.findByTestId("weight-undo"));
  await waitFor(() =>
    expect(recordWeight).toHaveBeenCalledWith({ weighedOn: "2026-03-02", weightKg: 62.4 }),
  );
});

it("draws nothing as a gap, and says so when there is nothing yet", () => {
  renderWithIntl(<WeightPanel weight={view({ entries: [], latest: null })} profile={profile} today={TODAY} />);
  expect(screen.getByTestId("weight-empty")).toBeInTheDocument();
  expect(screen.queryByTestId("weight-curve")).not.toBeInTheDocument();
});

it("keeps only the form on the account page", () => {
  renderWithIntl(<WeightPanel weight={view()} profile={profile} today={TODAY} compact />);
  expect(screen.queryByTestId("weight-curve")).not.toBeInTheDocument();
  expect(screen.queryByTestId("weight-entries")).not.toBeInTheDocument();
  expect(screen.getByTestId("weight-submit")).toBeInTheDocument();
});
