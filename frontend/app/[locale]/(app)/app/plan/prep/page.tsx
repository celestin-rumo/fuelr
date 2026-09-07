import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@app/lib/api";
import type { PrepSession } from "@app/lib/api";
import { isIsoDate, mondayOf, todayIso } from "@app/lib/week";
import { buttonClasses } from "@ui/button";
import { EmptyState } from "@ui/empty-state";
import { Icon } from "@ui/icons";
import { Container } from "@app/components/site/section";
import { PrepSessionView } from "@app/components/app/prep-session";

export const dynamic = "force-dynamic";

/**
 * Cooking the week in one session.
 *
 * A read of the plan as it already stands — nothing here chooses dishes, and
 * nothing here is paid for: whether two dishes share a base is arithmetic over
 * lines the library already holds.
 */
export default async function PrepPage({
  searchParams,
}: PageProps<"/[locale]/app/plan/prep">) {
  const t = await getTranslations("plan.prep");

  const { week } = await searchParams;
  const requested = isIsoDate(week) ? week : todayIso();

  const response = await apiFetch(`/api/plan/prep?week=${requested}`);
  if (!response.ok) {
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

  const session = (await response.json()) as PrepSession;
  const monday = mondayOf(session.weekStart);

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

      {/* Links that look like controls. A Button inside a Link would be two
          interactive elements where the markup promises one. */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={{ pathname: "/app/plan", query: { week: monday } }}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {t("backToPlan")}
        </Link>
        {/* Two hours of cooking are done with a sheet of paper, not a phone
            that goes dark. A page of its own, like every other print here. */}
        <Link
          href={{ pathname: "/app/plan/prep/print", query: { week: monday } }}
          data-testid="print-prep"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {t("print.button")}
        </Link>
      </div>

      <PrepSessionView session={session} week={monday} />
    </Container>
  );
}
