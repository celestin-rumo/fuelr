import { useTranslations } from "next-intl";

/**
 * The first thing Tab reaches, and the only control on the page that a mouse
 * never sees.
 *
 * Without it, reaching the content costs a dozen presses through the same
 * header — on every page, every time. That is not a small annoyance for
 * somebody who navigates this way; it is the difference between a site that
 * can be used and one that can be endured.
 *
 * It is invisible until focused rather than hidden: an element that is
 * `display: none` cannot be focused at all, which is the usual way a skip link
 * ends up present in the markup and absent in practice. `sr-only` alone has
 * the same problem in reverse — it stays announced but never appears, so a
 * sighted keyboard user cannot see where they are.
 */
export const MAIN_ID = "contenu";

export function SkipLink() {
  const t = useTranslations("system");

  return (
    <a
      href={`#${MAIN_ID}`}
      data-testid="skip-link"
      className={[
        // Off-screen until focus lands on it, then a real control in the
        // top-left corner, above everything the page has.
        "sr-only focus:not-sr-only",
        "focus:fixed focus:top-3 focus:left-3 focus:z-[100]",
        "focus:inline-flex focus:h-11 focus:items-center focus:rounded-full",
        "focus:bg-accent focus:px-5 focus:text-[13px] focus:font-bold focus:text-on-accent",
        "focus:outline-2 focus:outline-offset-2 focus:outline-[var(--mint-ink)]",
      ].join(" ")}
    >
      {t("skipToContent")}
    </a>
  );
}
