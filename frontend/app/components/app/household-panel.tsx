"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Dialog } from "@ui/dialog";
import { LaunchNote } from "./launch-note";
import { Button } from "@ui/button";
import { Card, CardTitle } from "@ui/card";
import { Input } from "@ui/input";
import type { Household, Subscription } from "@app/lib/api";
import {
  cancelPlan,
  inviteMember,
  joinHousehold,
  leaveHousehold,
  orderPlan,
  removeMember,
  revokeInvitation,
} from "@app/[locale]/(app)/app/household/actions";

/**
 * The household screen, and the only place the paid boundary is visible.
 *
 * It reads the boundary from the API — `sharingOpen` for the household,
 * `canOrder` for whether a plan can be bought at all — rather than deciding
 * anything itself. A screen that made its own mind up about who has paid would
 * eventually disagree with the backend, and the backend is the one holding the
 * data.
 */
export function HouseholdPanel({
  household,
  subscription,
  invitation,
}: {
  household: Household;
  subscription: Subscription;
  /** A token from an invitation link, when the visitor arrived through one. */
  invitation: string | null;
}) {
  const t = useTranslations("household");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Who is about to be removed, while the question is on screen.
  const [removing, setRemoving] = useState<Household["members"][number] | null>(null);

  const seatsLeft = household.maxAccounts - household.members.length;
  const shared = household.members.length > 1;

  function run(action: () => Promise<{ ok: boolean }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(t("errors.failed"));
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  function join() {
    if (!invitation) return;
    setError(null);
    startTransition(async () => {
      const result = await joinHousehold(invitation);
      if (!result.ok) {
        setError(t(`errors.${result.reason}`));
        return;
      }
      // The token is spent; leaving it in the URL would offer to use it again
      // on every reload.
      router.replace({ pathname: "/app/household" });
      router.refresh();
    });
  }

  function invite(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setError(null);
    setSent(null);
    startTransition(async () => {
      const result = await inviteMember(address, locale);
      if (!result.ok) {
        setError(t(`errors.${result.reason}`));
        return;
      }
      setSent(address);
      setEmail("");
      router.refresh();
    });
  }

  return (
    // Capped like body text: a list of five names does not get better for
    // being stretched across a desktop.
    <div className="flex max-w-3xl flex-col gap-6">
      {error && (
        <Banner tone="error" data-testid="household-error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {invitation && (
        <Card as="panel" data-testid="invitation">
          <CardTitle>{t("invitation.title")}</CardTitle>
          <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("invitation.body")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={join} loading={pending}>
              {t("invitation.accept")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.replace({ pathname: "/app/household" })}
            >
              {t("invitation.ignore")}
            </Button>
          </div>
        </Card>
      )}

      {/* What the account is on, and what that opens. Said in what it does,
          never in a tier name alone. */}
      <Card as="panel" data-testid="plan">
        <CardTitle>{t("plan.title")}</CardTitle>
        <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
          {household.sharingOpen
            ? t(household.owner ? "plan.openOwner" : "plan.openMember")
            : t("plan.closed")}
        </p>

        {/* Sharing is open to everybody today. Saying so is the difference
            between a gift and a surprise on the day it stops being one. */}
        {subscription.openPeriod && <LaunchNote className="mt-3" />}

        {household.owner && !household.sharingOpen && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {subscription.canOrder ? (
              <Button
                data-testid="order-family"
                loading={pending}
                onClick={() => run(() => orderPlan("FAMILY"))}
              >
                {t("plan.order")}
              </Button>
            ) : (
              // No provider is wired, so nothing here pretends one is.
              <p data-testid="not-purchasable" className="text-[15px] font-semibold text-text-dim">
                {t("plan.notPurchasable")}
              </p>
            )}
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
            >
              {t("plan.compare")}
            </Link>
          </div>
        )}

        {household.owner && household.sharingOpen && (
          <div className="mt-6">
            <Button
              variant="danger"
              data-testid="cancel-plan"
              loading={pending}
              onClick={() => run(() => cancelPlan())}
            >
              {t("plan.cancel")}
            </Button>
            <p className="mt-2 text-[13px] font-semibold text-gray">{t("plan.cancelHint")}</p>
          </div>
        )}
      </Card>

      {/* Removing somebody is not undoable and not the person's own doing —
          they lose the shared plan without ever touching the screen. Asked
          once, with the name in the question, so a mis-tap on a 44px row
          costs a tap rather than a household. */}
      {removing && (
        <Dialog
          title={t("members.confirm.title", {
            name: removing.name ?? removing.email,
          })}
          closeLabel={t("members.confirm.close")}
          onClose={() => setRemoving(null)}
          data-testid="remove-member-confirm"
        >
          <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("members.confirm.body")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="danger"
              loading={pending}
              data-testid="remove-member-confirmed"
              onClick={() => {
                const member = removing;
                setRemoving(null);
                run(() => removeMember(member.userId));
              }}
            >
              {t("members.confirm.confirm")}
            </Button>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t("members.confirm.cancel")}
            </Button>
          </div>
        </Dialog>
      )}

      <Card as="panel">
        <CardTitle>
          {t("members.title", {
            count: household.members.length,
            max: household.maxAccounts,
          })}
        </CardTitle>

        <ul data-testid="members" className="mt-4 flex flex-col gap-2">
          {household.members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-bg-raised-2 p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display text-[13px] font-extrabold text-on-accent">
                {(member.name ?? member.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-text">
                  {member.name ?? member.email}
                  {member.you && ` · ${t("members.you")}`}
                </span>
                <span className="block truncate text-[13px] font-semibold text-gray">
                  {member.owner ? t("members.owner") : member.email}
                </span>
              </span>
              {household.owner && !member.owner && (
                <Button
                  variant="dangerText"
                  size="sm"
                  aria-label={t("members.remove", { name: member.name ?? member.email })}
                  onClick={() => setRemoving(member)}
                >
                  {t("members.removeShort")}
                </Button>
              )}
            </li>
          ))}
        </ul>

        {household.owner && household.sharingOpen && (
          <form className="mt-6 flex flex-col gap-3" onSubmit={invite}>
            <Input
              label={t("invite.label")}
              hint={t("invite.hint", { seats: Math.max(0, seatsLeft) })}
              type="email"
              name="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
            <div>
              <Button type="submit" loading={pending} disabled={seatsLeft <= 0}>
                {t("invite.submit")}
              </Button>
            </div>
            {sent && (
              <Banner tone="success" data-testid="invited">
                {t("invite.sent", { email: sent })}
              </Banner>
            )}
          </form>
        )}

        {household.owner && household.invitations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
              {t("invite.pending")}
            </h3>
            <ul data-testid="pending-invitations" className="mt-2 flex flex-col gap-2">
              {household.invitations.map((pendingInvitation) => (
                <li
                  key={pendingInvitation.id}
                  className="flex flex-wrap items-center gap-3 rounded-sm border border-dashed border-line p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-dim">
                    {pendingInvitation.email}
                  </span>
                  <Button
                    variant="text"
                    size="sm"
                    aria-label={t("invite.revoke", { email: pendingInvitation.email })}
                    onClick={() => run(() => revokeInvitation(pendingInvitation.id))}
                  >
                    {t("invite.revokeShort")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!household.owner && (
          <div className="mt-6">
            {leaving ? (
              <div className="flex flex-col gap-3">
                <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                  {t("leave.body")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    loading={pending}
                    onClick={() => run(() => leaveHousehold(), () => setLeaving(false))}
                  >
                    {t("leave.confirm")}
                  </Button>
                  <Button variant="secondary" onClick={() => setLeaving(false)}>
                    {t("leave.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setLeaving(true)}>
                {t("leave.action")}
              </Button>
            )}
          </div>
        )}
      </Card>

      {shared && (
        <p className="text-[13px] font-semibold text-gray">
          <Link
            href="/app/plan"
            className="text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
          >
            {t("toPlan")}
          </Link>
        </p>
      )}
    </div>
  );
}
