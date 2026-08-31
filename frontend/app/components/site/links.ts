import type { routing } from "@/i18n/routing";

/**
 * Internal paths that take no parameters — the only ones a message catalogue
 * can express, since a stored href is a plain string with nowhere to put an
 * `id`. Dynamic routes like `/app/recipes/[id]` are excluded on purpose.
 */
export type Pathnames = Exclude<
  keyof typeof routing.pathnames,
  `${string}[${string}`
>;
