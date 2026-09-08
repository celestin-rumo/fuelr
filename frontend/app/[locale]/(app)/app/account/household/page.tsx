import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { Household, Subscription } from "@app/lib/api";
import { AccountSection } from "@app/components/app/account-section";
import { HouseholdPanel } from "@app/components/app/household-panel";

export const dynamic = "force-dynamic";

/**
 * The household, on its own page under the account. Invitation links land
 * here through the old address, carrying their token.
 */
export default async function HouseholdSectionPage({
  searchParams,
}: PageProps<"/[locale]/app/account/household">) {
  const t = await getTranslations("account");
  const { token } = await searchParams;
  const invitation = typeof token === "string" ? token : null;
  const [householdResponse, subscriptionResponse] = await Promise.all([
    apiFetch("/api/household"),
    apiFetch("/api/subscription"),
  ]);
  const household: Household | null = householdResponse.ok ? await householdResponse.json() : null;
  const subscription: Subscription | null = subscriptionResponse.ok ? await subscriptionResponse.json() : null;

  return (
    <AccountSection title={t("hub.cards.household.title")} intro={t("sections.household")}>
      {household && subscription ? (
        <HouseholdPanel household={household} subscription={subscription} invitation={invitation} />
      ) : (
        <p className="text-[15px] font-medium text-text-dim">{t("tabs.unavailable")}</p>
      )}
    </AccountSection>
  );
}
