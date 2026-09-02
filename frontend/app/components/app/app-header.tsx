import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@app/components/theme-toggle";
import { LogoutButton } from "./logout-button";
import { Container } from "@app/components/site/section";

/**
 * Product chrome. Deliberately not the marketing header: a signed-in person
 * gets navigation into their own data, not a pricing link.
 */
export function AppHeader({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const t = useTranslations("app");

  return (
    <header className="border-b border-line bg-bg-raised">
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link href="/app" className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-accent">
            <svg viewBox="0 0 24 24" fill="var(--on-accent)" className="size-4">
              <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
            </svg>
          </span>
          <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
            Fuelr
          </span>
        </Link>

        {/* The two places a signed-in person actually lives. The labels stay
            readable at every width — an icon-only nav would need explaining —
            so below `sm`, where the bar has about 80px to spare and the nav
            wants twice that, it drops to a line of its own instead of pushing
            the theme toggle off the screen. */}
        <nav
          aria-label={t("nav.label")}
          className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto"
        >
          <Link
            href="/app"
            className="rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
          >
            {t("nav.recipes")}
          </Link>
          <Link
            href="/app/plan"
            className="rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
          >
            {t("nav.plan")}
          </Link>
        </nav>

        <div className="flex-1" />

        <span className="hidden text-[13px] font-semibold text-text-dim sm:inline">
          {name ?? email}
        </span>
        <ThemeToggle />
        <LogoutButton />
        <span className="sr-only">{t("signedIn")}</span>
      </Container>
    </header>
  );
}
