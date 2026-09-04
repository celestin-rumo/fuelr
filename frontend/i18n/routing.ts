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
    "/privacy": {
      fr: "/confidentialite",
      en: "/privacy",
      de: "/datenschutz",
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
    "/app/plan": {
      fr: "/app/planning",
      en: "/app/plan",
      de: "/app/wochenplan",
    },
    "/app/journal": {
      fr: "/app/journal",
      en: "/app/journal",
      de: "/app/tagebuch",
    },
    "/app/menu": {
      fr: "/app/idees",
      en: "/app/ideas",
      de: "/app/ideen",
    },
    "/app/shopping": {
      fr: "/app/courses",
      en: "/app/shopping",
      de: "/app/einkaufen",
    },
    // Invitation links point here, so these slugs are duplicated in the
    // backend's EmailLinks. Changing one means changing the other.
    "/app/household": {
      fr: "/app/foyer",
      en: "/app/household",
      de: "/app/haushalt",
    },
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
    "/app/recipes/[id]/print": {
      fr: "/app/recettes/[id]/imprimer",
      en: "/app/recipes/[id]/print",
      de: "/app/rezepte/[id]/drucken",
    },
    "/app/shopping/print": {
      fr: "/app/courses/imprimer",
      en: "/app/shopping/print",
      de: "/app/einkaufen/drucken",
    },
    "/app/recipes/[id]/cook": {
      fr: "/app/recettes/[id]/cuisiner",
      en: "/app/recipes/[id]/cook",
      de: "/app/rezepte/[id]/kochen",
    },
    // What the service worker serves when a page cannot be reached. Same slug
    // everywhere, because the worker addresses it by literal URL and nobody
    // ever types it.
    "/offline": "/offline",
    // Internal reference page; the slug is the same in every locale.
    "/design-system": "/design-system",
    // Internal, like the design system: one slug, English copy, and no
    // translation — it is read by whoever runs Fuelr, not by whoever cooks.
    "/total-costs": "/total-costs",
  },
});
