import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { ProfileResponse, Referral } from "@app/lib/api";
import { getSession } from "@app/lib/session";
import { todayIso } from "@app/lib/week";
import { Disclosure } from "@ui/disclosure";
import { AccountSection } from "@app/components/app/account-section";
import { AccountPanel } from "@app/components/app/account-panel";
import { RecommendPanel } from "@app/components/app/recommend-panel";

export const dynamic = "force-dynamic";

/**
 * Every card folds; the two that matter open by default.
 *
 * *Vous* holds what is true of the person — first name, birth date, height,
 * weight, sex — and *Activité et objectif* the two figures that change and
 * take the journal's target with them. Then, behind a fold each, what is
 * touched once a year or less: the address, the language, the password, the
 * link to share. The weight typed on the first card is today's weigh-in; the
 * history stays on the journal.
 */
export default async function ProfilePage() {
  const t = await getTranslations("account");
  const session = await getSession();
  if (!session) return null;
  const today = todayIso();
  const [profileResponse, referralResponse] = await Promise.all([
    apiFetch("/api/profile"),
    apiFetch("/api/account/referral"),
  ]);
  const profile: ProfileResponse | null = profileResponse.ok ? await profileResponse.json() : null;
  const referral: Referral | null = referralResponse.ok ? await referralResponse.json() : null;

  return (
    <AccountSection title={t("hub.cards.profile.title")} intro={t("sections.profile")}>
      {/* Open by default, and foldable: once the figures are right there is
          nothing on it to read twice. */}
      <Disclosure title={t("you.title")} hint={t("you.hint")} defaultOpen data-testid="disclosure-you">
        <AccountPanel session={session} profile={profile} today={today} sections={["you"]} />
      </Disclosure>
      <Disclosure title={t("goals.title")} hint={t("goals.hint")} defaultOpen data-testid="disclosure-goals">
        <AccountPanel session={session} profile={profile} sections={["goals"]} />
      </Disclosure>

      <Disclosure title={t("email.title")} hint={t("email.hint")} data-testid="disclosure-email">
        <AccountPanel session={session} profile={profile} sections={["email"]} />
      </Disclosure>

      <Disclosure title={t("language.title")} hint={t("language.hint")} data-testid="disclosure-language">
        <AccountPanel session={session} profile={profile} sections={["language"]} />
      </Disclosure>

      <Disclosure title={t("password.title")} hint={t("password.hint")} data-testid="disclosure-password">
        <AccountPanel session={session} profile={profile} sections={["password"]} />
      </Disclosure>

      {referral && (
        <Disclosure title={t("hub.recommend")} hint={t("hub.recommendHint")} data-testid="disclosure-recommend">
          <RecommendPanel referral={referral} />
        </Disclosure>
      )}
    </AccountSection>
  );
}
