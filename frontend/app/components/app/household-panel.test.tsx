import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { Household, Subscription } from "@app/lib/api";
import { HouseholdPanel } from "./household-panel";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  Link: ({
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

const inviteMember = vi.fn(async () => ({ ok: true }));
const joinHousehold = vi.fn(async () => ({ ok: true }));
const leaveHousehold = vi.fn(async () => ({ ok: true }));
const removeMember = vi.fn(async () => ({ ok: true }));
const revokeInvitation = vi.fn(async () => ({ ok: true }));
const orderPlan = vi.fn(async () => ({ ok: true }));
const cancelPlan = vi.fn(async () => ({ ok: true }));

vi.mock("@app/[locale]/(app)/app/household/actions", () => ({
  inviteMember: (...args: unknown[]) => inviteMember(...(args as [])),
  joinHousehold: (...args: unknown[]) => joinHousehold(...(args as [])),
  leaveHousehold: (...args: unknown[]) => leaveHousehold(...(args as [])),
  removeMember: (...args: unknown[]) => removeMember(...(args as [])),
  revokeInvitation: (...args: unknown[]) => revokeInvitation(...(args as [])),
  orderPlan: (...args: unknown[]) => orderPlan(...(args as [])),
  cancelPlan: (...args: unknown[]) => cancelPlan(...(args as [])),
}));

const OWNER = {
  userId: 1,
  name: "Céline",
  email: "celine@fuelr.app",
  owner: true,
  you: true,
  joinedAt: null,
};

const GUEST = {
  userId: 2,
  name: "Camille",
  email: "camille@fuelr.app",
  owner: false,
  you: false,
  joinedAt: "2026-03-01T10:00:00Z",
};

function householdWith(overrides: Partial<Household> = {}): Household {
  return {
    id: 9,
    size: 2,
    owner: true,
    sharingOpen: false,
    maxAccounts: 6,
    members: [OWNER],
    invitations: [],
    ...overrides,
  };
}

function subscriptionWith(overrides: Partial<Subscription> = {}): Subscription {
  return {
    tier: "FREE",
    status: "CANCELED",
    period: "MONTHLY",
    currentPeriodEnd: null,
    features: [],
    canOrder: false,
    ...overrides,
  };
}

function renderPanel(
  household = householdWith(),
  subscription = subscriptionWith(),
  invitation: string | null = null,
) {
  return renderWithIntl(
    <HouseholdPanel
      household={household}
      subscription={subscription}
      invitation={invitation}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HouseholdPanel", () => {
  it("offers no invitation at all without the paid plan", () => {
    renderPanel();

    expect(screen.queryByLabelText("Inviter par email")).not.toBeInTheDocument();
    expect(screen.getByTestId("plan")).toHaveTextContent("plan Famille");
  });

  it("does not pretend a plan can be bought while nothing can take the money", () => {
    renderPanel();

    expect(screen.queryByTestId("order-family")).not.toBeInTheDocument();
    expect(screen.getByTestId("not-purchasable")).toBeInTheDocument();
    // The way to read what the plan contains is still offered.
    expect(screen.getByRole("link", { name: "Comparer les plans" })).toBeInTheDocument();
  });

  it("offers the plan once the API says one can be ordered", async () => {
    const user = userEvent.setup();
    renderPanel(householdWith(), subscriptionWith({ canOrder: true }));

    await user.click(screen.getByTestId("order-family"));

    await waitFor(() => expect(orderPlan).toHaveBeenCalledWith("FAMILY"));
    expect(refresh).toHaveBeenCalled();
  });

  it("invites by email and says where the invitation went", async () => {
    const user = userEvent.setup();
    renderPanel(householdWith({ sharingOpen: true }));

    await user.type(screen.getByLabelText("Inviter par email"), "ami@fuelr.app");
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));

    await waitFor(() =>
      expect(inviteMember).toHaveBeenCalledWith("ami@fuelr.app", "fr"),
    );
    expect(await screen.findByTestId("invited")).toHaveTextContent("ami@fuelr.app");
  });

  it("turns a refused invitation into the plan that would allow it", async () => {
    const user = userEvent.setup();
    inviteMember.mockResolvedValueOnce({
      ok: false,
      reason: "upgrade_required",
    } as unknown as { ok: true });
    renderPanel(householdWith({ sharingOpen: true }));

    await user.type(screen.getByLabelText("Inviter par email"), "ami@fuelr.app");
    await user.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));

    expect(await screen.findByTestId("household-error")).toHaveTextContent(
      "demande le plan Famille",
    );
  });

  it("shows pending invitations to the owner and lets them be called off", async () => {
    const user = userEvent.setup();
    renderPanel(
      householdWith({
        sharingOpen: true,
        invitations: [{ id: 5, email: "ami@fuelr.app", expiresAt: "2026-03-10T10:00:00Z" }],
      }),
    );

    expect(screen.getByTestId("pending-invitations")).toHaveTextContent("ami@fuelr.app");
    await user.click(
      screen.getByRole("button", { name: "Annuler l'invitation de ami@fuelr.app" }),
    );

    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith(5));
  });

  it("a member sees the household without its invitations, and can leave", async () => {
    const user = userEvent.setup();
    renderPanel(
      householdWith({ owner: false, sharingOpen: true, members: [OWNER, GUEST] }),
    );

    expect(screen.queryByTestId("pending-invitations")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inviter par email")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitter le foyer" }));
    // Asked first: leaving is not a click away from losing a shared week.
    expect(screen.getByText(/Tu retrouveras ton propre planning/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitter" }));

    await waitFor(() => expect(leaveHousehold).toHaveBeenCalled());
  });

  it("lets the owner show a member out, and never themselves", async () => {
    const user = userEvent.setup();
    renderPanel(householdWith({ sharingOpen: true, members: [OWNER, GUEST] }));

    expect(
      screen.queryByRole("button", { name: /Retirer Céline/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirer Camille du foyer" }));

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith(2));
  });

  it("accepts an invitation carried in the link, then drops the spent token", async () => {
    const user = userEvent.setup();
    renderPanel(householdWith(), subscriptionWith(), "invitation-token");

    await user.click(screen.getByRole("button", { name: "Rejoindre le foyer" }));

    await waitFor(() => expect(joinHousehold).toHaveBeenCalledWith("invitation-token"));
    // Left in the URL it would offer to be used again on every reload.
    expect(replace).toHaveBeenCalledWith({ pathname: "/app/household" });
  });

  it("says a spent invitation is spent rather than failing silently", async () => {
    const user = userEvent.setup();
    joinHousehold.mockResolvedValueOnce({
      ok: false,
      reason: "gone",
    } as unknown as { ok: true });
    renderPanel(householdWith(), subscriptionWith(), "old-token");

    await user.click(screen.getByRole("button", { name: "Rejoindre le foyer" }));

    expect(await screen.findByTestId("household-error")).toHaveTextContent(
      "n'est plus valable",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("says cancelling deletes nothing, next to the button that cancels", async () => {
    const user = userEvent.setup();
    renderPanel(
      householdWith({ sharingOpen: true }),
      subscriptionWith({ tier: "FAMILY", status: "ACTIVE", canOrder: true }),
    );

    expect(screen.getByTestId("plan")).toHaveTextContent("Rien n'est supprimé");
    await user.click(screen.getByTestId("cancel-plan"));

    await waitFor(() => expect(cancelPlan).toHaveBeenCalled());
  });
});
