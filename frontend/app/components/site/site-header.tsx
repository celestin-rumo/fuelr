"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { ThemeToggle } from "@app/components/theme-toggle";
import { buttonClasses } from "@ui/button";
import { cn } from "@ui/cn";
import { Container } from "./section";
import { Icon } from "@ui/icons";

const NAV = [
  { href: "/", key: "home" },
  { href: "/features", key: "features" },
  { href: "/pricing", key: "pricing" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export function SiteHeader() {
  const t = useTranslations("site.nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-accent">
            <svg viewBox="0 0 24 24" fill="var(--on-accent)" className="size-4">
              <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
            </svg>
          </span>
          <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
            Fuelr
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                  // A filled surface for the current page, the same answer the
                  // chips, the segmented control and the tab bar give.
                  active
                    ? "border-transparent bg-accent text-on-accent"
                    : "border-line text-text-dim hover:border-gray hover:text-text",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <ThemeToggle />

        {/* The display toggle sits on the wrapper, not on the Button: the
            Button's own base class sets `inline-flex`, and `.hidden` is
            emitted earlier in the stylesheet, so `hidden` on the Button loses
            and the CTA stayed visible at 375px — pushing every marketing page
            88px sideways. */}
        <span className="hidden sm:block">
          <Link href="/start" className={buttonClasses({ size: "sm" })}>
            {t("cta")}
          </Link>
        </span>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid size-9 place-items-center rounded-full border border-line text-text lg:hidden"
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </Container>

      {open && (
        <nav className="border-t border-line lg:hidden">
          <Container className="flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-sm px-2 py-3 text-[15px] font-semibold",
                  pathname === item.href ? "text-accent-ink" : "text-text-dim",
                )}
              >
                {t(item.key)}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
