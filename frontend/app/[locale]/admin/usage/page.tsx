import { notFound } from "next/navigation";
import { adminUsage } from "@app/lib/api";
import { Card, CardTitle } from "@ui/card";

export const dynamic = "force-dynamic";

/**
 * What is actually used, counted from the tables that already hold it.
 *
 * Nothing here is nominative: totals, and the share of accounts that touched
 * something at least once. The privacy page says this application runs no
 * analytics, and that stays true — these are counts of rows the database
 * already contains, not events anybody was instrumented to produce. The detail
 * per account is a different section, reached with a reason.
 */
export default async function AdminUsagePage() {
  const report = await adminUsage();
  if (!report) notFound();

  const share = (accounts: number) =>
    report.accounts === 0 ? "—" : `${Math.round((accounts / report.accounts) * 100)}%`;

  return (
    <Card as="panel">
      <CardTitle>What gets used</CardTitle>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
        Counted from rows that already exist rather than from events — which is
        why this page adds no personal data to an application that says it
        collects none. {report.accounts} accounts in total.
      </p>

      {/* Wide table, its own box: the page never scrolls sideways. */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-4 text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                What
              </th>
              <th className="py-2 pr-4 text-right text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                Total
              </th>
              <th className="py-2 pr-4 text-right text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                This month
              </th>
              <th className="py-2 text-right text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                Accounts
              </th>
            </tr>
          </thead>
          <tbody>
            {report.counts.map((row) => (
              <tr key={row.what} className="border-b border-line last:border-0">
                <td className="py-3 pr-4 text-[15px] font-medium text-text">
                  {row.what}
                </td>
                <td className="tnum py-3 pr-4 text-right font-mono text-[13px] font-bold text-text">
                  {row.total.toLocaleString("en-GB")}
                </td>
                <td className="tnum py-3 pr-4 text-right font-mono text-[13px] text-text-dim">
                  {row.thisMonth.toLocaleString("en-GB")}
                </td>
                <td className="tnum py-3 text-right font-mono text-[13px] text-text-dim">
                  {row.accountsUsing.toLocaleString("en-GB")}{" "}
                  <span className="text-gray">({share(row.accountsUsing)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
