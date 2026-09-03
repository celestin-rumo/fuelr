import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { ShoppingListView } from "@app/lib/api";
import { isIsoDate, todayIso } from "@app/lib/week";
import { PrintPage } from "@app/components/app/print-page";
import { ShoppingPrint } from "@app/components/app/shopping-print";

export const dynamic = "force-dynamic";

/**
 * The week's list, as a sheet of paper.
 *
 * Reading the list regenerates it, here as anywhere else — quantities
 * recomputed, ticks kept. Printing is a read like any other, and must not be
 * a snapshot frozen somewhere of its own.
 */
export default async function ShoppingPrintPage({
  searchParams,
  params,
}: PageProps<"/[locale]/app/shopping/print">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { week } = await searchParams;
  const requested = isIsoDate(week) ? week : todayIso();

  const response = await apiFetch(`/api/shopping?week=${requested}`);
  if (!response.ok) {
    notFound();
  }
  const list = (await response.json()) as ShoppingListView;

  return (
    <PrintPage>
      <ShoppingPrint list={list} week={list.weekStart} />
    </PrintPage>
  );
}
