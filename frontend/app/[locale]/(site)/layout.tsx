import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@app/components/site/site-header";
import { SiteFooter } from "@app/components/site/site-footer";

/**
 * Public marketing shell. The product lives under /app with its own layout —
 * this header and footer are for visitors, not for signed-in users.
 *
 * `setRequestLocale` has to run here as well as in each page: without it the
 * footer's `useTranslations` opts the whole subtree into dynamic rendering,
 * and the marketing pages stop being prerendered.
 */
export default async function SiteLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
