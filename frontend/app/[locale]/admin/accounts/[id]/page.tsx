import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { adminAccount } from "@app/lib/api";
import { Badge } from "@ui/badge";
import { Card, CardTitle } from "@ui/card";
import { Icon } from "@ui/icons";

export const dynamic = "force-dynamic";

function dollars(micros: number) {
  return `$${(micros / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-3 last:border-0">
      <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
        {label}
      </span>
      <span className="text-[15px] font-medium text-text">{children}</span>
    </div>
  );
}

/**
 * One account, in full — for answering somebody who wrote in.
 *
 * Everything on this page is theirs, which is why the panel it sits inside
 * answers 404 to everybody else.
 */
export default async function AdminAccountPage({
  params,
}: PageProps<"/[locale]/admin/accounts/[id]">) {
  const { id } = await params;
  const detail = await adminAccount(Number(id));
  if (!detail) notFound();

  const { account, subscription, household, history } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/accounts"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-mint-ink hover:underline"
      >
        <Icon name="arrowLeft" size={16} />
        All accounts
      </Link>

      <Card as="panel">
        <CardTitle className="flex flex-wrap items-center gap-2">
          {account.email}
          {account.role === "ADMIN" && <Badge tone="mint">operator</Badge>}
        </CardTitle>
        <div className="mt-4">
          <Line label="Name">{account.name ?? "—"}</Line>
          <Line label="Joined">
            {new Date(account.createdAt).toISOString().slice(0, 10)}
          </Line>
          <Line label="Address">
            {account.emailVerified ? "confirmed" : "not confirmed"}
          </Line>
          <Line label="Recipes">{account.recipes}</Line>
        </div>
      </Card>

      <Card as="panel">
        <CardTitle>Plan</CardTitle>
        <div className="mt-4">
          <Line label="Tier">{subscription?.tier ?? "FREE"}</Line>
          <Line label="Status">{subscription?.status ?? "no subscription"}</Line>
          <Line label="Period ends">
            {subscription?.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toISOString().slice(0, 10)
              : "—"}
          </Line>
          {subscription?.grantedByHand && (
            <Line label="Origin">granted by an operator</Line>
          )}
        </div>
      </Card>

      <Card as="panel">
        <CardTitle>Household</CardTitle>
        {household === null ? (
          <p className="mt-3 text-[15px] font-medium text-text-dim">
            Not in a household yet — one is made the first time they plan
            anything.
          </p>
        ) : (
          <div className="mt-4">
            <Line label="Role">{household.owner ? "owner" : "member"}</Line>
            <Line label="Cooks for">{household.size}</Line>
            <Line label="Members">
              {household.members.length === 0 ? "—" : household.members.join(", ")}
            </Line>
          </div>
        )}
      </Card>

      <Card as="panel">
        <CardTitle>Assisted reads, this month</CardTitle>
        <div className="mt-4">
          <Line label="Spent">{dollars(detail.aiCostMicrosThisMonth)}</Line>
          <Line label="Their ceiling">{dollars(detail.aiBudgetMicros)}</Line>
        </div>
      </Card>

      <Card as="panel">
        <CardTitle>What an operator did to this account</CardTitle>
        {history.length === 0 ? (
          <p className="mt-3 text-[15px] font-medium text-text-dim">
            Nothing. Every hand-granted tier and every deletion is written down
            here.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {history.map((entry, index) => (
              <li key={index} className="flex flex-col gap-1 py-3">
                <span className="font-mono text-[13px] font-bold text-text">
                  {entry.action}
                </span>
                <span className="text-[13px] font-medium text-text-dim">
                  {entry.detail ?? "—"}
                </span>
                <span className="tnum font-mono text-[12px] text-gray">
                  {new Date(entry.at).toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  {entry.actorEmail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
