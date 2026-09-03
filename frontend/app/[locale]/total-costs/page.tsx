import { use } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Card, CardTitle } from "@ui/card";
import { Container } from "@app/components/site/section";
import { getSession } from "@app/lib/session";
import { aiCosts } from "@app/lib/api";
import type { AiCostReport } from "@app/lib/api";

/**
 * What the assisted reads have cost, and who made them.
 *
 * An operator's page. Like `/design-system` it is internal, so its copy is
 * English like the rest of the codebase and it is deliberately not translated
 * — it is read by whoever runs Fuelr, not by whoever cooks with it.
 *
 * `notFound` rather than a redirect or a 403: a page that exists only for
 * operators has no reason to confirm to anybody else that it exists. The
 * backend answers the same way, so the two agree even if somebody calls the
 * endpoint directly.
 */
export const dynamic = "force-dynamic";

/** Micro-dollars are what is stored; dollars are what a person reads. */
function dollars(micros: number) {
  return `$${(micros / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
}

function cents(micros: number) {
  return `${(micros / 10_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ¢`;
}

function whole(value: number) {
  return value.toLocaleString("en-US");
}

function day(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

function Accounts({
  title,
  rows,
  showBudget,
}: {
  title: string;
  rows: AiCostReport["accountsThisMonth"];
  showBudget: boolean;
}) {
  return (
    <Card as="panel">
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="mt-3 text-[15px] font-medium text-text-dim">
          No assisted read yet.
        </p>
      ) : (
        // Its own scroller: seven columns of figures do not fold, and the page
        // body must never scroll sideways.
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                <th className="py-2 pr-4 text-left font-bold">Account</th>
                <th className="py-2 pr-4 text-right font-bold">Calls</th>
                <th className="py-2 pr-4 text-right font-bold">Tokens in</th>
                <th className="py-2 pr-4 text-right font-bold">Tokens out</th>
                <th className="py-2 pr-4 text-right font-bold">Cost</th>
                {showBudget && (
                  <th className="py-2 pr-4 text-right font-bold">Of budget</th>
                )}
                <th className="py-2 text-right font-bold">Last call</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-semibold text-text">{row.email}</td>
                  <td className="tnum py-2 pr-4 text-right font-mono text-text-dim">
                    {whole(row.calls)}
                  </td>
                  <td className="tnum py-2 pr-4 text-right font-mono text-text-dim">
                    {whole(row.inputTokens)}
                  </td>
                  <td className="tnum py-2 pr-4 text-right font-mono text-text-dim">
                    {whole(row.outputTokens)}
                  </td>
                  <td className="tnum py-2 pr-4 text-right font-mono font-bold text-text">
                    {dollars(row.costMicros)}
                  </td>
                  {showBudget && (
                    <td
                      className={`tnum py-2 pr-4 text-right font-mono font-bold ${
                        row.budgetMicros > 0 && row.costMicros >= row.budgetMicros
                          ? "text-coral-ink"
                          : "text-text-dim"
                      }`}
                    >
                      {row.budgetMicros === 0
                        ? // No plan, so no ceiling — and no reads either, unless
                          // one was recorded before a cancellation.
                          "no plan"
                        : `${Math.round((row.costMicros / row.budgetMicros) * 100)}%`}
                    </td>
                  )}
                  <td className="tnum py-2 text-right font-mono text-gray">
                    {day(row.lastCall)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function TotalCostsPage({ params }: PageProps<"/[locale]/total-costs">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const session = use(getSession());
  if (session?.role !== "ADMIN") {
    notFound();
  }

  const report = use(aiCosts());
  if (!report) {
    notFound();
  }

  return (
    <Container className="flex flex-col gap-8 py-12">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          Operations
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          Assisted reads, and what they cost
        </h1>
        <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          Figures in US dollars, as the provider bills them, from the tokens it
          reported for each call. Nothing here is estimated.
        </p>
      </div>

      <Card as="panel">
        <CardTitle>This month</CardTitle>
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Figure
            label="Spent"
            value={dollars(report.month.costMicros)}
            hint={cents(report.month.costMicros)}
          />
          <Figure label="Calls" value={whole(report.month.calls)} />
          <Figure label="Tokens in" value={whole(report.month.inputTokens)} />
          <Figure label="Tokens out" value={whole(report.month.outputTokens)} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Figure
            label="Since the start"
            value={dollars(report.allTime.costMicros)}
          />
          <Figure label="Calls" value={whole(report.allTime.calls)} />
          <Figure
            label="Average per call"
            value={
              report.allTime.calls === 0
                ? "—"
                : dollars(report.allTime.costMicros / report.allTime.calls)
            }
          />
          <Figure label="Accounts" value={whole(report.accountsAllTime.length)} />
        </div>
      </Card>

      <Card as="panel">
        <CardTitle>By operation, this month</CardTitle>
        {report.operationsThisMonth.length === 0 ? (
          <p className="mt-3 text-[15px] font-medium text-text-dim">
            No assisted read this month.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {report.operationsThisMonth.map((row) => (
              <li
                key={row.operation}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
              >
                <span className="font-mono text-[13px] font-bold text-text">
                  {row.operation}
                </span>
                <span className="tnum font-mono text-[13px] text-text-dim">
                  {whole(row.calls)} calls · {whole(row.inputTokens)} in ·{" "}
                  {whole(row.outputTokens)} out
                </span>
                <span className="tnum font-mono text-[13px] font-bold text-text">
                  {dollars(row.costMicros)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Accounts
        title="By account, this month"
        rows={report.accountsThisMonth}
        showBudget
      />
      <Accounts
        title="By account, since the start"
        rows={report.accountsAllTime}
        showBudget={false}
      />
    </Container>
  );
}
