import { notFound } from "next/navigation";
import { adminSubscriptions, adminEnforcement } from "@app/lib/api";
import { Banner } from "@ui/banner";
import { Card, CardTitle } from "@ui/card";

export const dynamic = "force-dynamic";

function money(cents: number, currency: string) {
  return `${(cents / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
        {label}
      </span>
      <span className="tnum font-display text-[28px] leading-none font-extrabold tracking-[-0.02em] text-text">
        {value}
      </span>
      {hint && <span className="text-[12px] font-medium text-gray">{hint}</span>}
    </div>
  );
}

/**
 * How many plans exist, of what kind, and what they would bill.
 *
 * Two things this page refuses to do. It does not call the committed figure
 * *revenue*: no payment provider is wired, so every subscription here was
 * granted rather than bought, and a theoretical number shown as received is
 * how a dashboard starts lying. And where the paid boundary is switched off —
 * production today — it says so, because a tier count then describes who
 * ordered something and not who can do anything.
 */
export default async function AdminSubscriptionsPage() {
  const [report, enforcement] = await Promise.all([
    adminSubscriptions(),
    adminEnforcement(),
  ]);
  if (!report) notFound();

  return (
    <div className="flex flex-col gap-6">
      {!report.anyPaymentEverCollected && (
        <Banner tone="info" title="Nothing has been collected">
          No payment provider is wired, so every plan below was granted rather
          than bought. The committed figure is what these plans would bill at
          today&apos;s prices — not money received.
        </Banner>
      )}

      {enforcement && !enforcement.enforced && (
        <Banner tone="info" title="The paid boundary is off">
          <code>app.subscription.enforce</code> is false, so every account has
          every feature whatever its tier. These counts say who ordered
          something, not who can do anything.
        </Banner>
      )}

      <Card as="panel">
        <CardTitle>Where the accounts are</CardTitle>
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Figure label="Accounts" value={report.accounts.toLocaleString("en-GB")} />
          <Figure label="Active plans" value={report.active.toLocaleString("en-GB")} />
          <Figure
            label="Cancelled"
            value={report.cancelled.toLocaleString("en-GB")}
            hint={`${report.cancelledStillRunning} still inside a paid period`}
          />
          <Figure
            label="Committed / month"
            value={money(report.monthlyCommittedCents, report.currency)}
            hint="not collected"
          />
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-4 text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                  Tier
                </th>
                <th className="py-2 pr-4 text-right text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                  Accounts
                </th>
                <th className="py-2 text-right text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                  Active subscriptions
                </th>
              </tr>
            </thead>
            <tbody>
              {report.tiers.map((row) => (
                <tr key={row.tier} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4 font-mono text-[13px] font-bold text-text">
                    {row.tier}
                  </td>
                  <td className="tnum py-3 pr-4 text-right font-mono text-[13px] text-text">
                    {row.accounts.toLocaleString("en-GB")}
                  </td>
                  <td className="tnum py-3 text-right font-mono text-[13px] text-text-dim">
                    {row.activeSubscriptions.toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card as="panel">
        <CardTitle>Orders</CardTitle>
        <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          A pending order is somebody who wanted to pay and could not. Until a
          provider exists, it is the only evidence that the demand is real.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <Figure
            label="Pending"
            value={report.ordersPending.toLocaleString("en-GB")}
            hint="tried to pay, could not"
          />
          <Figure label="Settled" value={report.ordersPaid.toLocaleString("en-GB")} />
        </div>
      </Card>

      <Card as="panel">
        <CardTitle>Month by month</CardTitle>
        {report.months.length === 0 ? (
          <p className="mt-3 text-[15px] font-medium text-text-dim">
            Nothing started or ended yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {report.months.map((month) => (
              <li
                key={month.month}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span className="font-mono text-[13px] font-bold text-text">
                  {month.month}
                </span>
                <span className="tnum font-mono text-[13px] text-text-dim">
                  +{month.started} started · −{month.cancelled} cancelled
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
