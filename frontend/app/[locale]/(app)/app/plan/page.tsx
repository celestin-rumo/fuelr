import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@app/lib/api";
import type { RecipeSummary, WeekPlan } from "@app/lib/api";
import { isIsoDate, todayIso } from "@app/lib/week";
import { Button } from "@ui/button";
import { EmptyState } from "@ui/empty-state";
import { Container } from "@app/components/site/section";
import { WeekPlanner } from "@app/components/app/week-planner";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: PageProps<"/[locale]/app/plan">) {
  const t = await getTranslations("plan");

  // The week lives in the URL, so a plan can be linked to and the back button
  // walks back through the weeks that were looked at.
  const { week } = await searchParams;
  const today = todayIso();
  const requested = isIsoDate(week) ? week : today;

  const [planResponse, recipeResponse] = await Promise.all([
    apiFetch(`/api/plan?week=${requested}`),
    apiFetch("/api/recipes"),
  ]);

  const plan: WeekPlan | null = planResponse.ok ? await planResponse.json() : null;
  const recipes: RecipeSummary[] = recipeResponse.ok ? await recipeResponse.json() : [];

  if (!plan) {
    return (
      <Container className="py-14">
        <EmptyState
          tone="error"
          icon="!"
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
      </div>

      {/* Nothing to plan with is a different state from an empty week, and it
          has a different answer: write a recipe first. */}
      {recipes.length === 0 ? (
        <EmptyState
          icon="◷"
          title={t("noRecipes.title")}
          body={t("noRecipes.body")}
          action={
            <Link href="/app/recipes/new">
              <Button>{t("noRecipes.action")}</Button>
            </Link>
          }
        />
      ) : (
        <WeekPlanner plan={plan} recipes={recipes} today={today} />
      )}
    </Container>
  );
}
