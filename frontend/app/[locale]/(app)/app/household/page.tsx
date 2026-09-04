import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { Household, Subscription } from "@app/lib/api";
import { EmptyState } from "@ui/empty-state";
import { Container } from "@app/components/site/section";
import { HouseholdPanel } from "@app/components/app/household-panel";
import { Icon } from "@ui/icons";

export const dynamic = "force-dynamic";

export default async function HouseholdPage({
  searchParams,
}: PageProps<"/[locale]/app/household">) {
  const t = await getTranslations("household");

  // Invitation links land here carrying their token. Signed out, the proxy
  // sends the visitor to login with this whole URL in `next`, so the token
  // survives having to sign in first.
  const { token } = await searchParams;
  const invitation = typeof token === "string" ? token : null;

  const [householdResponse, subscriptionResponse] = await Promise.all([
    apiFetch("/api/household"),
    apiFetch("/api/subscription"),
  ]);

  const household: Household | null = householdResponse.ok
    ? await householdResponse.json()
    : null;
  const subscription: Subscription | null = subscriptionResponse.ok
    ? await subscriptionResponse.json()
    : null;

  if (!household || !subscription) {
    return (
      <Container className="py-14">
        <EmptyState
          tone="error"
          icon={<Icon name="alert" size={24} />}
          title={t("unavailable.title")}
          body={t("unavailable.body")}
        />
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-8 py-14">
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

      <HouseholdPanel
        household={household}
        subscription={subscription}
        invitation={invitation}
      />
    </Container>
  );
}
