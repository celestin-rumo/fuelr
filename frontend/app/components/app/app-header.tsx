import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@ui/icons";
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
  role,
}: {
  email: string;
  name: string | null;
  role: string;
}) {
  const t = useTranslations("app");

  return (
    <header className="border-b border-line bg-bg-raised">
      {/* Tighter gaps below `sm`: with the navigation gone to the bottom bar,
          the logo, the idea button and the two controls fit one row at 360px
          — but only just, so they are not given 16px of air each. `flex-wrap`
          stays as the fallback for a locale whose words run longer. */}
      <Container className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 sm:h-16 sm:flex-nowrap sm:gap-x-4 sm:py-0">
        <Link
          href="/app"
          className="flex min-h-11 shrink-0 items-center gap-2.5 sm:min-h-0"
        >
          <span className="grid size-8 place-items-center rounded-full bg-accent">
            <svg viewBox="0 0 24 24" fill="var(--on-accent)" className="size-4">
              <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
            </svg>
          </span>
          <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
            Fuelr
          </span>
        </Link>

        {/* Where a signed-in person actually lives, on a screen wide enough
            to hold it. Below `sm` this bar has about 80px to spare and five
            readable labels want four times that: the navigation moves to
            `AppTabs`, at the bottom, where the thumb already is. */}
        <nav
          aria-label={t("nav.label")}
          className="hidden flex-wrap items-center gap-x-1 gap-y-0.5 sm:flex"
        >
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
          >
            {t("nav.recipes")}
          </Link>
          <Link
            href="/app/plan"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
          >
            {t("nav.plan")}
          </Link>
          <Link
            href="/app/shopping"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
          >
            {t("nav.shopping")}
          </Link>
          <Link
            href="/app/journal"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
          >
            {t("nav.journal")}
          </Link>
          <Link
            href="/app/household"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-[13px] font-semibold text-text-dim hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
          >
            {t("nav.household")}
          </Link>
        </nav>

        <div className="flex-1" />

        {/*
         * The operator's page had no link anywhere: it was reachable only by
         * typing a URL nobody had written down. It appears for an admin and
         * for nobody else — which is the same rule the page and the endpoint
         * already follow, since a screen that exists only for operators has
         * no reason to confirm to anybody else that it exists.
         */}
        {role === "ADMIN" && (
          <Link
            href="/total-costs"
            aria-label={t("nav.costs")}
            data-testid="costs-link"
            className="grid size-11 shrink-0 place-items-center rounded-full text-gray transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
          >
            <Icon name="clock" />
          </Link>
        )}

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
