import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { apiFetch } from "@app/lib/api";
import type { RecipeSummary } from "@app/lib/api";
import { Button } from "@ui/button";
import { EmptyState } from "@ui/empty-state";
import { RecipeGrid } from "@app/components/app/recipe-grid";
import { Container } from "@app/components/site/section";
import { isSeason } from "@app/lib/seasons";
import { todayIso } from "@app/lib/week";

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
        {/* Three actions are 428px of buttons and a 360px screen has 320 of
            room, so on a phone they stack — and they stack in order of what
            somebody came to do. Creating leads, importing follows, exporting
            is a twice-a-year errand and goes last. Above `sm` the row reads
            the other way round, weakest first, ending on the primary. */}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/app/recipes/new"
            className="order-1 w-full sm:order-3 sm:w-auto"
          >
            <Button size="lg" fullWidth className="sm:w-auto">
              {t("newRecipe")}
            </Button>
          </Link>
          {/* Importing sits beside creating, not hidden inside it: pasting a
              link is a different intent from starting a blank recipe. */}
          <Link
            href="/app/recipes/import"
            className="order-2 w-full sm:order-2 sm:w-auto"
          >
            <Button size="lg" variant="secondary" fullWidth className="sm:w-auto">
              {t("importRecipe")}
            </Button>
          </Link>
          {recipes.length > 0 && (
            <a
              href="/api/recipes/export"
              download
              className="order-3 inline-flex min-h-11 items-center justify-center rounded-full border border-line px-4 text-[13px] font-semibold text-text-dim hover:border-gray hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:order-1 sm:min-h-9"
            >
              {t("export")}
            </a>
          )}
        </div>
      </div>

      {recipes.length === 0 && !filtering ? (
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
        <RecipeGrid
          recipes={recipes}
          term={term}
          selectedTags={selected}
          selectedSeasons={inSeason}
          today={todayIso()}
        />
      )}
    </Container>
  );
}
