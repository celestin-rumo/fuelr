import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { ReminderPanel } from "./reminder-panel";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
const setReminder = vi.fn(async () => ({ ok: true as const, reminder: { day: 7, hour: 18 } }));
vi.mock("@app/[locale]/(app)/app/account/actions", () => ({
  setReminder: (...args: unknown[]) => setReminder(...(args as [])),
}));

beforeEach(() => vi.clearAllMocks());

it("is off until asked for, and says the other mails cannot be", () => {
  renderWithIntl(<ReminderPanel reminder={{ day: null, hour: null }} />);
  expect(screen.getByTestId("reminder-switch")).not.toBeChecked();
  expect(screen.queryByText("Quel jour")).not.toBeInTheDocument();
  expect(screen.getByText(/ne se désactivent pas/)).toBeInTheDocument();
});

it("turns on to Sunday evening, and off to nothing", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<ReminderPanel reminder={{ day: null, hour: null }} />);

  await user.click(screen.getByTestId("reminder-switch"));
  await waitFor(() => expect(setReminder).toHaveBeenCalledWith({ day: 7, hour: 18 }));
  expect(screen.getByText("Quel jour")).toBeInTheDocument();

  await user.click(screen.getByTestId("reminder-switch"));
  await waitFor(() => expect(setReminder).toHaveBeenLastCalledWith({ day: null, hour: null }));
});
