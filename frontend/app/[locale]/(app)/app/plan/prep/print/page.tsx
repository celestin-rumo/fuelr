import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { PrepSession } from "@app/lib/api";
import { isIsoDate, todayIso } from "@app/lib/week";
import { PrintPage } from "@app/components/app/print-page";
import { PrepPrint } from "@app/components/app/prep-print";

export const dynamic = "force-dynamic";

/**
 * The session as a sheet of paper.
 *
 * The one screen in this application that is more likely to be printed than
 * read: two hours of cooking happen with wet hands and a phone that has gone
 * dark, and the whole plan has to be visible at once rather than scrolled.
 */
export default async function PrepPrintPage({
  searchParams,
  params,
}: PageProps<"/[locale]/app/plan/prep/print">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { week } = await searchParams;
  const requested = isIsoDate(week) ? week : todayIso();

  const response = await apiFetch(`/api/plan/prep?week=${requested}`);
  if (!response.ok) {
    notFound();
  }
  const session = (await response.json()) as PrepSession;

  return (
    <PrintPage>
      <PrepPrint session={session} />
    </PrintPage>
  );
}
