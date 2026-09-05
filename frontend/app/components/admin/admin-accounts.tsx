"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Dialog } from "@ui/dialog";
import { Icon } from "@ui/icons";
import { Input } from "@ui/input";
import { ListRow, ListRowActions, ListRowMeta, ListRowTitle } from "@ui/list-row";
import { Menu } from "@ui/menu";
import { Pagination } from "@ui/pagination";
import { Segmented } from "@ui/segmented";
import type { AdminAccountRow, AdminDeletionPreview } from "@app/lib/api";
import {
  deleteAccount,
  previewDeletion,
  setTier,
} from "@app/[locale]/admin/accounts/actions";

const TIERS = ["FREE", "PLUS", "FAMILY"] as const;

/**
 * How many accounts fit on a page.
 *
 * The first version showed all two hundred the endpoint returns, which on a
 * real database is a sixteen-thousand-pixel page nobody can use — and an
 * operator does not read accounts, they look one up. Twenty, and the search
 * above is what does the actual work.
 */
const PER_PAGE = 20;

/**
 * The accounts, and the one action in this whole panel that destroys data
 * belonging to somebody else.
 *
 * Deleting asks first, with the address in the question, and the question is
 * built from what the server says the deletion would actually carry away —
 * not from a sentence written here. It is the only way the household warning
 * can be true: whether somebody else's week is at stake is a fact about the
 * database, not about the shape of this dialog.
 */
export function AdminAccounts({
  accounts,
  query,
}: {
  accounts: AdminAccountRow[];
  query: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [term, setTerm] = useState(query);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [granting, setGranting] = useState<AdminAccountRow | null>(null);
  const [tier, setChosenTier] = useState<string>("PLUS");
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState<{
    account: AdminAccountRow;
    preview: AdminDeletionPreview;
  } | null>(null);
  const [typed, setTyped] = useState("");
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(accounts.length / PER_PAGE));
  // Clamped rather than trusted: the last page disappears the moment a search
  // narrows the list or an account is deleted.
  const current = Math.min(page, pages - 1);
  const shown = accounts.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (term.trim()) next.set("q", term.trim());
    else next.delete("q");
    router.push(`?${next.toString()}`);
  }

  function grant(account: AdminAccountRow) {
    setError(null);
    startTransition(async () => {
      const result = await setTier(account.id, tier, reason);
      if (!result.ok) {
        setError(`Could not change the tier for ${account.email}.`);
        return;
      }
      setGranting(null);
      setReason("");
      setDone(`${account.email} is now on ${tier}.`);
      router.refresh();
    });
  }

  function askToRemove(account: AdminAccountRow) {
    setError(null);
    startTransition(async () => {
      const result = await previewDeletion(account.id);
      if (!result.ok) {
        setError(`Could not read what deleting ${account.email} would remove.`);
        return;
      }
      setTyped("");
      setRemoving({ account, preview: result.preview });
    });
  }

  function remove() {
    if (!removing) return;
    const account = removing.account;
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (!result.ok) {
        setError(`Could not delete ${account.email}.`);
        return;
      }
      setRemoving(null);
      setDone(`${account.email} and everything it contained is gone.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Banner tone="error" data-testid="admin-error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {done && (
        <Banner tone="success" data-testid="admin-done" onDismiss={() => setDone(null)}>
          {done}
        </Banner>
      )}

      <Card as="panel">
        <form className="flex flex-wrap items-end gap-3" onSubmit={search}>
          <div className="min-w-[16rem] flex-1">
            <Input
              label="Find an account"
              placeholder="An email address"
              hint="You arrive here with an address in hand."
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </div>
          <Button type="submit" data-testid="admin-search">
            Search
          </Button>
        </form>
      </Card>

      {accounts.length === 0 ? (
        <p data-testid="admin-no-accounts" className="text-[15px] font-medium text-text-dim">
          No account matches.
        </p>
      ) : (
        <ul data-testid="admin-accounts" className="flex flex-col gap-2">
          {shown.map((account) => (
            <ListRow
              as="li"
              key={account.id}
              data-testid={`admin-account-${account.id}`}
              trailing={
                <ListRowActions>
                  <Menu
                    label={`Actions for ${account.email}`}
                    items={[
                      {
                        label: "Change the tier",
                        icon: "pencil",
                        onSelect: () => {
                          setChosenTier(account.tier === "FREE" ? "PLUS" : "FREE");
                          setGranting(account);
                        },
                      },
                      {
                        label: "Delete this account",
                        icon: "trash",
                        destructive: true,
                        onSelect: () => askToRemove(account),
                      },
                    ]}
                  />
                </ListRowActions>
              }
            >
              <ListRowTitle className="flex flex-wrap items-center gap-2">
                <Link
                  href={{
                    pathname: "/admin/accounts/[id]",
                    params: { id: String(account.id) },
                  }}
                  className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
                >
                  {account.email}
                </Link>
                {account.tier !== "FREE" && <Badge tone="accent">{account.tier}</Badge>}
                {account.role === "ADMIN" && <Badge tone="mint">operator</Badge>}
                {!account.emailVerified && (
                  <Badge tone="neutral">address unconfirmed</Badge>
                )}
              </ListRowTitle>
              <ListRowMeta className="tnum font-mono">
                {new Date(account.createdAt).toISOString().slice(0, 10)} ·{" "}
                {account.recipes} recipes
                {account.ownsTheHousehold
                  ? " · owns a shared household"
                  : account.sharesAHousehold
                    ? " · in a shared household"
                    : ""}
              </ListRowMeta>
            </ListRow>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <Pagination
          page={current}
          pages={pages}
          onChange={setPage}
          labels={{
            nav: "Account pages",
            previous: "Previous page",
            next: "Next page",
            position: `Page ${current + 1} of ${pages} · ${accounts.length} accounts${
              accounts.length >= 200 ? " (capped — search to narrow)" : ""
            }`,
          }}
        />
      )}

      {granting && (
        <Dialog
          title={`Change the tier for ${granting.email}`}
          closeLabel="Close"
          onClose={() => setGranting(null)}
          data-testid="tier-dialog"
        >
          <div className="flex flex-col gap-5">
            <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
              Granted by hand, and indistinguishable from a paid plan
              everywhere else — it goes through the same method a payment
              webhook will call. Who did it and why is written down.
            </p>
            <Segmented
              label="Tier"
              value={tier}
              onChange={setChosenTier}
              data-testid="tier-choice"
              options={TIERS.map((one) => ({ value: one, label: one }))}
            />
            <Input
              label="Why"
              placeholder="A refund, a gesture, a mistake put right"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <Button loading={pending} onClick={() => grant(granting)} data-testid="tier-confirm">
                Apply
              </Button>
              <Button variant="secondary" onClick={() => setGranting(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {removing && (
        <Dialog
          title={`Delete ${removing.account.email}?`}
          closeLabel="Close"
          onClose={() => setRemoving(null)}
          data-testid="delete-dialog"
        >
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
              This erases the account and everything in it — there is no undo.
            </p>

            <ul className="flex flex-col gap-1 text-[14px] font-medium text-text">
              <li className="flex items-center gap-2">
                <Icon name="trash" size={16} className="text-coral-ink" />
                {removing.preview.recipes} recipes, {removing.preview.photos}{" "}
                photographs
              </li>
              <li className="flex items-center gap-2">
                <Icon name="trash" size={16} className="text-coral-ink" />
                their plan, shopping list, diary and household
              </li>
            </ul>

            {removing.preview.householdHandedOver && (
              // The trap the schema sets: `households` cascades from `users`
              // and `planned_meals` cascades from `households`, so a naive
              // delete would take away every meal every *member* had put on
              // that week.
              <Banner tone="info" title="Somebody else is in their household">
                The household passes to{" "}
                <span className="font-mono text-[13px]">
                  {removing.preview.newOwnerEmail}
                </span>
                , so the shared week is not deleted with this account. Sharing
                then follows the new owner&apos;s plan, like any other
                cancellation.
              </Banner>
            )}

            <Input
              label="Type the address to confirm"
              placeholder={removing.account.email}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              status={
                typed.length > 0 && typed !== removing.account.email
                  ? "error"
                  : "default"
              }
              data-testid="delete-confirm-input"
            />

            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                loading={pending}
                disabled={typed !== removing.account.email}
                onClick={remove}
                data-testid="delete-confirm"
              >
                Delete permanently
              </Button>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
