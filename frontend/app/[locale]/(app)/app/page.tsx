import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { apiFetch } from "@app/lib/api";
import type { RecipeSummary } from "@app/lib/api";
import { Button } from "@ui/button";
import { EmptyState } from "@ui/empty-state";
import { RecipeGrid } from "@app/components/app/recipe-grid";
import { Container } from "@app/components/site/section";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const t = await getTranslations("app");
  const session = await getSession();

  const response = await apiFetch("/api/recipes");
  const recipes: RecipeSummary[] = response.ok ? await response.json() : [];

  return (
    <Container className="flex flex-col gap-8 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t("label")}
          </span>
          <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
            {t("greeting", { name: session?.name ?? session?.email ?? "" })}
          </h1>
        </div>
        <Link href="/app/recipes/new">
          <Button size="lg">{t("newRecipe")}</Button>
        </Link>
      </div>

      {recipes.length === 0 ? (
        <EmptyState
          icon="◷"
          title={t("empty.title")}
          body={t("empty.body")}
          action={
            <Link href="/app/recipes/new">
              <Button>{t("newRecipe")}</Button>
            </Link>
          }
        />
      ) : (
        <RecipeGrid recipes={recipes} />
      )}
    </Container>
  );
}
