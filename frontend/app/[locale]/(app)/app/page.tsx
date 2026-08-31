import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { apiFetch } from "@app/lib/api";
import type { RecipeSummary } from "@app/lib/api";
import { Badge } from "@ui/badge";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { EmptyState } from "@ui/empty-state";
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link
                href={{
                  pathname: "/app/recipes/[id]",
                  params: { id: String(recipe.id) },
                }}
                className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
              >
                <Card interactive className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-base font-bold text-text">
                      {recipe.title?.trim() || t("untitled")}
                    </h2>
                    {recipe.status === "DRAFT" && (
                      <Badge tone="neutral">{t("draft")}</Badge>
                    )}
                  </div>
                  <p className="tnum mt-2 font-mono text-[12px] text-gray">
                    {t("counts", {
                      ingredients: recipe.ingredientCount,
                      steps: recipe.stepCount,
                    })}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
