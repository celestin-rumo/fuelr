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
    "/login": {
      fr: "/connexion",
      en: "/login",
      de: "/anmelden",
    },
    "/start": {
      fr: "/commencer",
      en: "/get-started",
      de: "/loslegen",
    },
    "/register": {
      fr: "/inscription",
      en: "/sign-up",
      de: "/registrieren",
    },
    "/verify-email": {
      fr: "/verification-email",
      en: "/verify-email",
      de: "/email-bestaetigen",
    },
    "/forgot-password": {
      fr: "/mot-de-passe-oublie",
      en: "/forgot-password",
      de: "/passwort-vergessen",
    },
    "/reset-password": {
      fr: "/nouveau-mot-de-passe",
      en: "/reset-password",
      de: "/neues-passwort",
    },
    // The product itself. Same slug everywhere: it is a destination people
    // bookmark and share between locales, not marketing copy.
    "/app": "/app",
    "/app/recipes/import": {
      fr: "/app/recettes/importer",
      en: "/app/recipes/import",
      de: "/app/rezepte/importieren",
    },
    "/app/recipes/new": {
      fr: "/app/recettes/nouvelle",
      en: "/app/recipes/new",
      de: "/app/rezepte/neu",
    },
    "/app/recipes/[id]": {
      fr: "/app/recettes/[id]",
      en: "/app/recipes/[id]",
      de: "/app/rezepte/[id]",
    },
    // Internal reference page; the slug is the same in every locale.
    "/design-system": "/design-system",
  },
});
