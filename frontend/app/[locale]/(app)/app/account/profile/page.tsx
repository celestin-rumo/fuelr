import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { ProfileResponse, Referral, WeightView } from "@app/lib/api";
import { getSession } from "@app/lib/session";
import { todayIso } from "@app/lib/week";
import { Disclosure } from "@ui/disclosure";
import { AccountSection } from "@app/components/app/account-section";
import { AccountPanel } from "@app/components/app/account-panel";
import { WeightPanel } from "@app/components/app/weight-panel";
import { RecommendPanel } from "@app/components/app/recommend-panel";

export const dynamic = "force-dynamic";

/**
 * Who this is, open; what is touched twice a year, shut until it is.
 */
export default async function ProfilePage() {
  const t = await getTranslations("account");
  const session = await getSession();
  if (!session) return null;
  const today = todayIso();
  const [profileResponse, weightResponse, referralResponse] = await Promise.all([
    apiFetch("/api/profile"),
    apiFetch(`/api/weight?to=${today}`),
    apiFetch("/api/account/referral"),
  ]);
  const profile: ProfileResponse | null = profileResponse.ok ? await profileResponse.json() : null;
  const weight: WeightView | null = weightResponse.ok ? await weightResponse.json() : null;
  const referral: Referral | null = referralResponse.ok ? await referralResponse.json() : null;

  return (
    <AccountSection title={t("hub.cards.profile.title")} intro={t("sections.profile")}>
      <AccountPanel session={session} profile={profile} sections={["identity", "email"]} />

      <Disclosure title={t("figures.title")} hint={t("figures.hint")} data-testid="disclosure-figures">
        <AccountPanel session={session} profile={profile} sections={["figures"]} />
      </Disclosure>

      {weight && (
        <Disclosure title={t("hub.weight")} hint={t("hub.weightHint")} data-testid="disclosure-weight">
          <WeightPanel weight={weight} profile={profile?.profile ?? null} today={today} compact />
        </Disclosure>
      )}

      {referral && (
        <Disclosure title={t("hub.recommend")} hint={t("hub.recommendHint")} data-testid="disclosure-recommend">
          <RecommendPanel referral={referral} />
        </Disclosure>
      )}
    </AccountSection>
  );
}
