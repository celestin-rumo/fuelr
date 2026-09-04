"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@ui/icons";
import { cn } from "@ui/cn";

/**
 * Where the application goes, on a phone.
 *
 * The header used to wrap its navigation onto a line of its own below `sm`,
 * because that bar has about 80px to spare and five readable labels want four
 * times that. Wrapping solved the overflow and nothing else: the navigation
 * ended up at the top of a screen held at the bottom, three rows deep, above
 * the thing somebody actually came to read.
 *
 * A phone is not a small desktop. The bar goes to the bottom, where the thumb
 * already is, and the header keeps the identity and the account controls.
 *
 * Two rules it does not break. Every destination stays reachable — five tabs,
 * not four with the household hidden behind something. And the icon comes
 * *with* its word: a bar of icons alone has to be learnt, and this one is read
 * by somebody holding a knife.
 */
const TABS = [
  { href: "/app", key: "recipes", icon: "book" },
  { href: "/app/plan", key: "plan", icon: "calendar" },
  { href: "/app/shopping", key: "shopping", icon: "cart" },
  { href: "/app/journal", key: "journal", icon: "journal" },
  { href: "/app/household", key: "household", icon: "people" },
] as const satisfies ReadonlyArray<{
  href: string;
  key: string;
  icon: IconName;
}>;

export function AppTabs() {
  const t = useTranslations("app");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.label")}
      data-testid="app-tabs"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg-raised sm:hidden",
        // The home indicator on an iPhone sits over the last few pixels; the
        // bar keeps its own height and pads below it.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          // `usePathname` answers in internal pathnames — `/app/plan` even
          // when the URL is `/fr/app/planning` — which is what makes this
          // comparison work in three locales without listing nine slugs.
          const active =
            tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2",
                  "text-[10px] font-bold transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                  active ? "text-accent-ink" : "text-gray",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                    // A filled surface for the current tab, the same answer
                    // the chips and the segmented control give.
                    active ? "bg-accent text-on-accent" : "bg-transparent",
                  )}
                >
                  <Icon name={tab.icon} size={19} />
                </span>
                <span className="max-w-full truncate">{t(`nav.${tab.key}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
