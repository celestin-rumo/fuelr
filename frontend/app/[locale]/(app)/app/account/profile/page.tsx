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
 * In the order things change. Who this is and what they are aiming for,
 * open; then, behind a fold each: the weigh-in — the one place to say what
 * you weigh — the figures that hardly move, the password, and the link to
 * share.
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
      <AccountPanel session={session} profile={profile} sections={["identity", "email", "goals"]} />

      {weight && (
        <Disclosure title={t("hub.weight")} hint={t("hub.weightHint")} data-testid="disclosure-weight">
          <WeightPanel weight={weight} today={today} compact />
        </Disclosure>
      )}

      <Disclosure title={t("body.title")} hint={t("body.hint")} data-testid="disclosure-body">
        <AccountPanel session={session} profile={profile} sections={["body"]} />
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
