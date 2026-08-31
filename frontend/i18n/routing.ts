import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "de"],

  defaultLocale: "fr",
  // Each route gets an entry here, with a translated slug per locale, e.g.
  //   "/recipes": { en: "/recipes", de: "/rezepte" }  (fr keeps the key itself)
  // Only "/" exists so far.
  pathnames: {
    "/": "/",
  },
});
