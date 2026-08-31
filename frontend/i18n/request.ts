import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// One file per namespace under app/messages/<locale>/. `common` stays flat at
// the root (theme labels and the like); everything else is nested under its
// own key, so `site.json` is read as t("site.hero.title").
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [common, site] = await Promise.all([
    import(`../app/messages/${locale}/common.json`),
    import(`../app/messages/${locale}/site.json`),
  ]);

  return {
    locale,
    messages: { ...common.default, site: site.default },
  };
});
