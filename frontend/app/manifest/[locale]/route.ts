import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * The web app manifest, one per locale.
 *
 * The metadata convention (`app/manifest.ts`) can only produce one file for
 * the whole app, and the install prompt is the app introducing itself — it
 * should not do that in a language nobody chose. So it is a route instead,
 * with the locale in the path.
 *
 * `proxy.ts` has to leave `/manifest` alone, or next-intl localises the URL
 * and the browser is sent to `/fr/manifest/fr`.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const known = routing.locales.includes(locale as (typeof routing.locales)[number]);
  const active = known ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: active, namespace: "manifest" });

  return Response.json(
    {
      name: t("name"),
      short_name: t("shortName"),
      description: t("description"),
      lang: active,
      // Straight into the app: someone installing this is not looking for the
      // marketing site.
      start_url: `/${active}/app`,
      scope: "/",
      display: "standalone",
      // The near-black ground, so the splash and the status bar are the app's
      // own dark rather than a white flash before it.
      background_color: "#121212",
      theme_color: "#121212",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
