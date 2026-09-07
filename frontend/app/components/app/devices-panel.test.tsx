import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { DeviceSession } from "@app/lib/api";
import { DevicesPanel } from "./devices-panel";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
const closeSession = vi.fn(async () => ({ ok: true }));
const closeOtherSessions = vi.fn(async () => ({ ok: true }));
vi.mock("@app/[locale]/(app)/app/account/actions", () => ({
  closeSession: (...args: unknown[]) => closeSession(...(args as [])),
  closeOtherSessions: (...args: unknown[]) => closeOtherSessions(...(args as [])),
}));

const laptop: DeviceSession = { id: "a", device: "Chrome · Linux", openedAt: "2026-03-01T10:00:00Z", lastSeenAt: "2026-03-09T08:00:00Z", current: true };
const phone: DeviceSession = { id: "b", device: "Safari · iOS", openedAt: "2026-03-02T10:00:00Z", lastSeenAt: "2026-03-08T21:00:00Z", current: false };

beforeEach(() => vi.clearAllMocks());

it("names each device in words and marks this one", () => {
  renderWithIntl(<DevicesPanel sessions={[laptop, phone]} />);

  const mine = screen.getByTestId("device-a");
  expect(within(mine).getByText("Chrome · Linux")).toBeInTheDocument();
  expect(within(mine).getByText("Cet appareil")).toBeInTheDocument();
  // This device closes through sign-out, never from here.
  expect(within(mine).queryByRole("button")).not.toBeInTheDocument();
});

it("closes one device by name, and all the others at once", async () => {
  const user = userEvent.setup({ delay: null });
  renderWithIntl(<DevicesPanel sessions={[laptop, phone]} />);

  await user.click(screen.getByRole("button", { name: "Fermer la session sur Safari · iOS" }));
  await waitFor(() => expect(closeSession).toHaveBeenCalledWith("b"));

  await user.click(screen.getByTestId("close-others"));
  await waitFor(() => expect(closeOtherSessions).toHaveBeenCalled());
});

it("offers nothing to close when this is the only device", () => {
  renderWithIntl(<DevicesPanel sessions={[laptop]} />);
  expect(screen.queryByTestId("close-others")).not.toBeInTheDocument();
});
