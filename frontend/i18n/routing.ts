import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "de"],

  defaultLocale: "fr",

  // Keys are the internal path used in code and on disk; values are the slug
  // shown per locale. Every new public route needs an entry here with a
  // translated slug, or the URL leaks English into the French site.
  pathnames: {
    "/": "/",
    "/features": {
      fr: "/fonctionnalites",
      en: "/features",
      de: "/funktionen",
    },
    "/pricing": {
      fr: "/tarifs",
      en: "/pricing",
      de: "/preise",
    },
    "/about": {
      fr: "/a-propos",
      en: "/about",
      de: "/ueber-uns",
    },
    "/contact": {
      fr: "/contact",
      en: "/contact",
      de: "/kontakt",
    },
    // Internal reference page; the slug is the same in every locale.
    "/design-system": "/design-system",
  },
});
