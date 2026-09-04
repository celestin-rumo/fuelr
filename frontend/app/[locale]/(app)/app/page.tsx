import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { apiFetch } from "@app/lib/api";
import type { RecipeSummary } from "@app/lib/api";
import { Button, buttonClasses } from "@ui/button";
import { Card, CardBody, CardTitle } from "@ui/card";
import { EmptyState } from "@ui/empty-state";
import { RecipeGrid } from "@app/components/app/recipe-grid";
import { LibraryActions } from "@app/components/app/library-actions";
import { Container } from "@app/components/site/section";
import { isSeason } from "@app/lib/seasons";
import { todayIso } from "@app/lib/week";
import { Icon } from "@ui/icons";

export const dynamic = "force-dynamic";

export default async function AppHomePage({
  searchParams,
}: PageProps<"/[locale]/app">) {
  const t = await getTranslations("app");
  const session = await getSession();

  // The query lives in the URL so a filtered library can be bookmarked and
  // shared, and so the back button undoes a filter.
  const { q, tags, seasons } = await searchParams;
  const term = typeof q === "string" ? q : "";
  const selected = typeof tags === "string" ? tags.split(",").filter(Boolean) : [];
  const inSeason =
    typeof seasons === "string" ? seasons.split(",").filter(isSeason) : [];

  const params = new URLSearchParams();
  if (term) params.set("q", term);
  for (const tag of selected) params.append("tags", tag);
  for (const season of inSeason) params.append("seasons", season);
  const query = params.toString();

  const response = await apiFetch(`/api/recipes${query ? `?${query}` : ""}`);
  const recipes: RecipeSummary[] = response.ok ? await response.json() : [];

  // Whether the library is empty, or merely filtered down to nothing, are two
  // different states and must not share a message.
  const filtering = term !== "" || selected.length > 0 || inSeason.length > 0;

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
        <LibraryActions canExport={recipes.length > 0} />
      </div>

      {recipes.length === 0 && !filtering ? (
        <EmptyState
          icon={<Icon name="book" size={24} />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={
            <Link href="/app/recipes/new">
              <Button>{t("newRecipe")}</Button>
            </Link>
          }
        />
      ) : (
        <RecipeGrid
          recipes={recipes}
          term={term}
          selectedTags={selected}
          selectedSeasons={inSeason}
          today={todayIso()}
        />
      )}

      {/*
       * Below the list, not in the header. It was a button beside the account
       * controls, which is where the app's chrome lives — and it is not
       * chrome, it is what to do when the list you have just read did not
       * answer the question. So it sits where that happens.
       */}
      <Card
        as="panel"
        data-testid="ask-idea-block"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="min-w-0">
          <CardTitle>{t("idea.title")}</CardTitle>
          <CardBody className="mt-1">{t("idea.body")}</CardBody>
        </div>
        <Link
          href="/app/menu"
          data-testid="ask-idea"
          className={buttonClasses({ variant: "soft", className: "shrink-0 gap-1.5" })}
        >
          <Icon name="flame" size={17} />
          {t("idea.action")}
        </Link>
      </Card>
    </Container>
  );
}
