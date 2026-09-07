import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { WeekPlan } from "@app/lib/api";
import { isIsoDate, todayIso } from "@app/lib/week";
import { PrintPage } from "@app/components/app/print-page";
import { WeekPrint } from "@app/components/app/week-print";

export const dynamic = "force-dynamic";

/**
 * The week, as a sheet for the fridge door.
 *
 * Its own address, like the recipe and the shopping list: a sheet is a page,
 * not a hidden copy of a screen — and it can be looked at before it is
 * printed, which a browser dialog cannot offer.
 */
export default async function WeekPrintPage({
  searchParams,
  params,
}: PageProps<"/[locale]/app/plan/print">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { week } = await searchParams;
  const requested = isIsoDate(week) ? week : todayIso();

  const response = await apiFetch(`/api/plan?week=${requested}`);
  if (!response.ok) {
    notFound();
  }
  const plan = (await response.json()) as WeekPlan;

  return (
    <PrintPage>
      <WeekPrint plan={plan} />
    </PrintPage>
  );
}
