import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Messages start flat: one `common.json` per locale. Split into namespaces
// (and load them the way snowfall-portfolio does) once the app grows.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../app/messages/${locale}/common.json`))
    .default;

  return { locale, messages };
});
