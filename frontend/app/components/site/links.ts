import type { routing } from "@/i18n/routing";

/**
 * The internal paths declared in i18n/routing.ts. Message files store hrefs as
 * plain strings, so this is what they get narrowed to before reaching `Link`.
 */
export type Pathnames = keyof typeof routing.pathnames;
