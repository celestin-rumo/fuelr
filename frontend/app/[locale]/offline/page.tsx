import { setRequestLocale } from "next-intl/server";
import { OfflineCooking } from "@app/components/app/offline-cooking";

/**
 * What the service worker serves when a page cannot be reached.
 *
 * Deliberately outside every route group: it must be fully static, and the
 * app's own layout resolves the session against the backend — which is exactly
 * the thing that is unreachable when this page is needed.
 *
 * It is not an error page. The dish being cooked is stored on the device, so
 * this is where cooking carries on.
 */
export default async function OfflinePage({
  params,
}: PageProps<"/[locale]/offline">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OfflineCooking />;
}
