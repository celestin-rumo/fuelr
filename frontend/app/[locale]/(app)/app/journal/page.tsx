import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { LogWeek, Subscription } from "@app/lib/api";
import { isIsoDate, mondayOf, todayIso } from "@app/lib/week";
import { EmptyState } from "@ui/empty-state";
import { Container } from "@app/components/site/section";
import { Journal } from "@app/components/app/journal";
import { Icon } from "@ui/icons";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: PageProps<"/[locale]/app/journal">) {
  const t = await getTranslations("journal");

  const { week } = await searchParams;
  const today = todayIso();
  const requested = isIsoDate(week) ? week : today;

  const [weekResponse, subscriptionResponse] = await Promise.all([
    apiFetch(`/api/log?week=${requested}`),
    apiFetch("/api/subscription"),
  ]);

  const logged: LogWeek | null = weekResponse.ok ? await weekResponse.json() : null;
  const subscription: Subscription | null = subscriptionResponse.ok
    ? await subscriptionResponse.json()
    : null;

  if (!logged) {
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

      <Journal
        week={logged}
        weekStart={mondayOf(logged.weekStart)}
        today={today}
        canOrder={subscription?.canOrder ?? false}
      />
    </Container>
  );
}
