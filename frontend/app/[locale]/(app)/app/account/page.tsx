import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@app/lib/api";
import type { DeviceSession, Household, Reminder } from "@app/lib/api";
import { getSession } from "@app/lib/session";
import { Icon } from "@ui/icons";
import type { IconName } from "@ui/icons";
import { Container } from "@app/components/site/section";

export const dynamic = "force-dynamic";

/**
 * The account is a hub, and the person chooses the first level.
 *
 * Nine forms on one page was a scroll; five tabs above them was a menu
 * nobody asked for. This is the shape the admin panel of gyoza has, and it
 * reads at a glance: who this is, then one card per thing somebody might
 * have come to do, grouped, each with a line saying what is behind it and,
 * where it helps, what its state is. Each card is a page of its own.
 */
type Section = {
  key: "profile" | "household" | "preferences" | "security" | "data";
  href: "/app/account/profile" | "/app/account/household" | "/app/account/preferences" | "/app/account/security" | "/app/account/data";
  icon: IconName;
};

const GROUPS: { key: string; sections: Section[] }[] = [
  { key: "you", sections: [
    { key: "profile", href: "/app/account/profile", icon: "user" },
    { key: "preferences", href: "/app/account/preferences", icon: "leaf" },
  ] },
  { key: "together", sections: [
    { key: "household", href: "/app/account/household", icon: "people" },
  ] },
  { key: "keys", sections: [
    { key: "security", href: "/app/account/security", icon: "lock" },
    { key: "data", href: "/app/account/data", icon: "archive" },
  ] },
];

export default async function AccountPage() {
  const t = await getTranslations("account");
  const session = await getSession();
  if (!session) return null;

  // Only what the cards say in one line; the sections fetch their own.
  const [householdResponse, sessionsResponse, reminderResponse] = await Promise.all([
    apiFetch("/api/household"),
    apiFetch("/api/auth/sessions"),
    apiFetch("/api/account/reminder"),
  ]);
  const household: Household | null = householdResponse.ok ? await householdResponse.json() : null;
  const sessions: DeviceSession[] = sessionsResponse.ok ? await sessionsResponse.json() : [];
  const reminder: Reminder | null = reminderResponse.ok ? await reminderResponse.json() : null;

  const status: Partial<Record<Section["key"], string>> = {
    household: household
      ? t("hub.status.household", { count: household.members?.length ?? 1 })
      : undefined,
    security: t("hub.status.security", { count: sessions.length }),
    preferences: reminder?.day != null ? t("hub.status.reminderOn") : t("hub.status.reminderOff"),
  };

  return (
    <Container className="flex max-w-3xl flex-col gap-10 py-10 sm:py-14">
      <header className="flex flex-col gap-2" data-testid="account-header">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("label")}
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          {session.name?.trim() || t("title")}
        </h1>
        <p className="text-[15px] font-medium text-text-dim" data-testid="account-email">
          {session.email}
        </p>
        <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          {t("hub.choose")}
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.key} className="flex flex-col gap-3" data-testid={`account-group-${group.key}`}>
          <h2 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t(`hub.groups.${group.key}`)}
          </h2>
          <ul className="flex flex-col gap-3">
            {group.sections.map((section) => (
              <li key={section.key}>
                <Link
                  href={section.href}
                  data-testid={`account-card-${section.key}`}
                  // One height for every card, whatever its line says: a list
                  // of doors reads as a list only when the doors match.
                  className="group flex min-h-28 items-center gap-4 rounded-md border border-line bg-bg-raised p-5 transition-[box-shadow,border-color] duration-[var(--dur)] ease-[var(--ease)] hover:border-gray hover:shadow-e1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-bg-raised-2 text-text">
                    <Icon name={section.icon} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-display text-[16px] font-bold text-text">
                      {t(`hub.cards.${section.key}.title`)}
                    </span>
                    <span className="text-[13px] leading-[1.5] font-medium text-text-dim">
                      {t(`hub.cards.${section.key}.description`)}
                    </span>
                    {status[section.key] && (
                      <span className="tnum mt-1 font-mono text-[11px] text-gray" data-testid={`account-status-${section.key}`}>
                        {status[section.key]}
                      </span>
                    )}
                  </span>
                  <Icon name="chevronRight" className="shrink-0 text-gray" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Container>
  );
}
