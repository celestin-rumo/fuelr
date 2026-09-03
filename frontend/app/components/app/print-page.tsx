"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@ui/button";

/**
 * A sheet of paper, shown on screen before it becomes one.
 *
 * The sheet gets its own address rather than hiding inside the screen it came
 * from. Three things follow from that, and all three are the reason.
 *
 * What is printed can be looked at first — the dialog is not the preview.
 * Nothing of the sheet is in the DOM of any other page, so no query anywhere
 * ever matches it twice; the first attempt kept it portalled into every screen
 * and broke eight tests that had every right to expect one match. And if a
 * server-rendered PDF is ever wanted, this is the page it renders.
 *
 * The toolbar is the only thing that does not print.
 */
export function PrintPage({ children }: { children: ReactNode }) {
  const t = useTranslations("print");
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Button onClick={() => window.print()} data-testid="do-print">
          {t("action")}
        </Button>
        <Button variant="text" onClick={() => router.back()}>
          {t("back")}
        </Button>
        <span className="text-[13px] font-medium text-gray">{t("hint")}</span>
      </div>

      {/* White and black from here down, on screen as on paper: a preview that
          does not look like the sheet is not a preview. */}
      <article
        data-testid="print-sheet"
        className="print-sheet rounded-md bg-white p-8 text-black shadow-e2 print:rounded-none print:p-0 print:shadow-none"
      >
        {children}
      </article>
    </div>
  );
}
