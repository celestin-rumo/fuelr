import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { DeviceSession, DietaryPreferences, ProfileResponse, Referral, Reminder, WeightView } from "@app/lib/api";
import { RecommendPanel } from "@app/components/app/recommend-panel";
import { ReminderPanel } from "@app/components/app/reminder-panel";
import { DevicesPanel } from "@app/components/app/devices-panel";
import { DataPanel } from "@app/components/app/data-panel";
import { PreferencesPanel } from "@app/components/app/preferences-panel";
import { todayIso } from "@app/lib/week";
import { WeightPanel } from "@app/components/app/weight-panel";
import { getSession } from "@app/lib/session";
import { Container } from "@app/components/site/section";
import { AccountPanel } from "@app/components/app/account-panel";

export const dynamic = "force-dynamic";

/**
 * Where somebody sees and corrects what Fuelr knows about them.
 *
 * The profile express was written once at registration and never shown
 * again; the name and the address had no screen at all. This is that screen.
 * The profile may be missing — an account created before the onboarding, or
 * one that skipped it — and that is a state the panel shows, not an error.
 */
export default async function AccountPage() {
  const t = await getTranslations("account");
  const session = await getSession();
  const today = todayIso();
  const [response, weightResponse, preferencesResponse, sessionsResponse, referralResponse, reminderResponse] =
    await Promise.all([
      apiFetch("/api/profile"),
      apiFetch(`/api/weight?to=${today}`),
      apiFetch("/api/preferences"),
      apiFetch("/api/auth/sessions"),
      apiFetch("/api/account/referral"),
      apiFetch("/api/account/reminder"),
    ]);
  const referral: Referral | null = referralResponse.ok ? await referralResponse.json() : null;
  const reminder: Reminder | null = reminderResponse.ok ? await reminderResponse.json() : null;
  const sessions: DeviceSession[] = sessionsResponse.ok ? await sessionsResponse.json() : [];
  const preferences: DietaryPreferences | null = preferencesResponse.ok
    ? await preferencesResponse.json()
    : null;
  const profile: ProfileResponse | null = response.ok ? await response.json() : null;
  const weight: WeightView | null = weightResponse.ok ? await weightResponse.json() : null;

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-14">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("label")}
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          {t("title")}
        </h1>
        <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          {t("intro")}
        </p>
      </div>

      {session && <AccountPanel session={session} profile={profile} />}

      {weight && (
        <WeightPanel weight={weight} profile={profile?.profile ?? null} today={today} compact />
      )}

      {preferences && <PreferencesPanel preferences={preferences} />}

      {sessions.length > 0 && <DevicesPanel sessions={sessions} />}

      {reminder && <ReminderPanel reminder={reminder} />}

      {referral && <RecommendPanel referral={referral} />}

      {session && <DataPanel email={session.email} />}
    </Container>
  );
}
