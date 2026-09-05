"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@ui/cn";
import { Icon, type IconName } from "@ui/icons";

/**
 * Where the panel goes.
 *
 * Not the app's tab bar and not the site's header: this is a third piece of
 * chrome, for a third audience of one. It scrolls sideways in its own box
 * below `sm` rather than wrapping, because four sections wrapped onto two
 * lines is how a narrow screen loses the section it is currently on.
 */
const SECTIONS = [
  { href: "/admin/accounts", label: "Accounts", icon: "people" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "calendar" },
  { href: "/admin/usage", label: "Usage", icon: "book" },
  { href: "/admin/ai-costs", label: "AI costs", icon: "clock" },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
}>;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      data-testid="admin-nav"
      className="-mx-1 overflow-x-auto"
    >
      <ul className="flex w-max gap-2 px-1">
        {SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[13px] font-bold",
                  "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                  active
                    ? "border-transparent bg-accent text-on-accent"
                    : "border-line text-text-dim hover:border-gray hover:text-text",
                )}
              >
                <Icon name={section.icon} size={17} />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
