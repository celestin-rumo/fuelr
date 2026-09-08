import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@app/lib/api";
import type {
  DeviceSession,
  DietaryPreferences,
  Household,
  ProfileResponse,
  Referral,
  Reminder,
  Subscription,
  WeightView,
} from "@app/lib/api";
import { getSession } from "@app/lib/session";
import { todayIso } from "@app/lib/week";
import { cn } from "@ui/cn";
import { Container } from "@app/components/site/section";
import { AccountPanel } from "@app/components/app/account-panel";
import { WeightPanel } from "@app/components/app/weight-panel";
import { PreferencesPanel } from "@app/components/app/preferences-panel";
import { DevicesPanel } from "@app/components/app/devices-panel";
import { DataPanel } from "@app/components/app/data-panel";
import { RecommendPanel } from "@app/components/app/recommend-panel";
import { ReminderPanel } from "@app/components/app/reminder-panel";
import { HouseholdPanel } from "@app/components/app/household-panel";

export const dynamic = "force-dynamic";

/**
 * The account, in five tabs.
 *
 * It was one long page of nine forms, and nine forms is past what anybody
 * scans — about seven things is the ceiling before a page becomes a search.
 * So the identity sits in front, where it is read at a glance, and the rest
 * is grouped by what somebody came to do: their profile, their household,
 * what they eat and hear from us, how they get in, and the two doors out.
 * The tab is in the URL, so a mailed invitation can land on the household
 * and a bookmark can land on security.
 *
 * Order inside the tabs follows use: the most-touched forms first, the
 * destructive ones last and on their own tab.
 */
const TABS = ["profile", "household", "preferences", "security", "data"] as const;
type TabKey = (typeof TABS)[number];

export default async function AccountPage({
  searchParams,
}: PageProps<"/[locale]/app/account">) {
  const t = await getTranslations("account");
  const session = await getSession();
  const { tab, token } = await searchParams;
  const current: TabKey = TABS.includes(tab as TabKey) ? (tab as TabKey) : "profile";
  const invitation = typeof token === "string" ? token : null;
  const today = todayIso();

  const [profileResponse, weightResponse, preferencesResponse, sessionsResponse,
    referralResponse, reminderResponse, householdResponse, subscriptionResponse] =
    await Promise.all([
      apiFetch("/api/profile"),
      apiFetch(`/api/weight?to=${today}`),
      apiFetch("/api/preferences"),
      apiFetch("/api/auth/sessions"),
      apiFetch("/api/account/referral"),
      apiFetch("/api/account/reminder"),
      apiFetch("/api/household"),
      apiFetch("/api/subscription"),
    ]);
  const profile: ProfileResponse | null = profileResponse.ok ? await profileResponse.json() : null;
  const weight: WeightView | null = weightResponse.ok ? await weightResponse.json() : null;
  const preferences: DietaryPreferences | null = preferencesResponse.ok
    ? await preferencesResponse.json()
    : null;
  const sessions: DeviceSession[] = sessionsResponse.ok ? await sessionsResponse.json() : [];
  const referral: Referral | null = referralResponse.ok ? await referralResponse.json() : null;
  const reminder: Reminder | null = reminderResponse.ok ? await reminderResponse.json() : null;
  const household: Household | null = householdResponse.ok ? await householdResponse.json() : null;
  const subscription: Subscription | null = subscriptionResponse.ok
    ? await subscriptionResponse.json()
    : null;

  if (!session) return null;

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-14">
      {/* The identity, in front and read at a glance: who this is, and how
          they are reached. Everything else is a tab away. */}
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
      </header>

      {/* Links styled as tabs: the tab is the URL, so it can be bookmarked and
          a mail can land on it. Scrolls sideways on a phone rather than
          wrapping into two rows above the content. */}
      <nav
        role="tablist"
        aria-label={t("tabs.label")}
        data-testid="account-tabs"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:gap-6 sm:px-0"
      >
        {TABS.map((key) => {
          const active = key === current;
          return (
            <Link
              key={key}
              role="tab"
              aria-selected={active}
              href={{ pathname: "/app/account", query: { tab: key } }}
              data-testid={`account-tab-${key}`}
              className={cn(
                "-mb-px inline-flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-2 text-[14px] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] sm:h-10 sm:px-0",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                active
                  ? "border-accent font-bold text-text"
                  : "border-transparent font-semibold text-text-dim hover:border-line hover:text-text",
              )}
            >
              {t(`tabs.${key}`)}
            </Link>
          );
        })}
      </nav>

      <div role="tabpanel" data-testid={`account-panel-${current}`} className="flex flex-col gap-8">
        {current === "profile" && (
          <>
            <AccountPanel session={session} profile={profile} sections={["identity", "email", "figures"]} />
            {weight && (
              <WeightPanel weight={weight} profile={profile?.profile ?? null} today={today} compact />
            )}
            {referral && <RecommendPanel referral={referral} />}
          </>
        )}

        {current === "household" &&
          (household && subscription ? (
            <HouseholdPanel household={household} subscription={subscription} invitation={invitation} />
          ) : (
            <p className="text-[15px] font-medium text-text-dim">{t("tabs.unavailable")}</p>
          ))}

        {current === "preferences" && (
          <>
            {preferences && <PreferencesPanel preferences={preferences} />}
            {reminder && <ReminderPanel reminder={reminder} />}
          </>
        )}

        {current === "security" && (
          <>
            <AccountPanel session={session} profile={profile} sections={["password"]} />
            {sessions.length > 0 && <DevicesPanel sessions={sessions} />}
          </>
        )}

        {current === "data" && <DataPanel email={session.email} />}
      </div>
    </Container>
  );
}
