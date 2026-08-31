"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { Chip } from "@ui/chip";
import { cn } from "@ui/cn";
import type { RecipeSummary } from "@app/lib/api";
import { setFavorite } from "@app/[locale]/(app)/app/recipes/actions";

/** Favourites first, then the order the backend already sorted them into. */
function sorted(recipes: RecipeSummary[]) {
  return [...recipes].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite),
  );
}

export function RecipeGrid({ recipes }: { recipes: RecipeSummary[] }) {
  const t = useTranslations("app");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // The pin flips on click and stays flipped while the request is in flight;
  // it is reverted only if the server refuses.
  const [optimistic, addOptimistic] = useOptimistic(
    recipes,
    (current: RecipeSummary[], toggled: { id: number; favorite: boolean }) =>
      current.map((r) =>
        r.id === toggled.id ? { ...r, favorite: toggled.favorite } : r,
      ),
  );

  const shown = sorted(optimistic).filter((r) => !onlyFavorites || r.favorite);
  const favoriteCount = optimistic.filter((r) => r.favorite).length;

  function toggle(recipe: RecipeSummary) {
    startTransition(async () => {
      addOptimistic({ id: recipe.id, favorite: !recipe.favorite });
      const result = await setFavorite(recipe.id, !recipe.favorite);
      // useOptimistic drops its value the moment the transition settles, so
      // without refetching the server data the pin springs back to whatever
      // the page was rendered with. Refresh so the real state catches up.
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Chip active={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>
          {t("filters.all")}
        </Chip>
        <Chip
          active={onlyFavorites}
          count={favoriteCount}
          onClick={() => setOnlyFavorites(true)}
        >
          {t("filters.favorites")}
        </Chip>
      </div>

      {shown.length === 0 ? (
        <p className="text-[15px] font-medium text-text-dim">
          {t("filters.noFavorites")}
        </p>
      ) : (
        <ul
          data-testid="recipe-grid"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {shown.map((recipe) => (
            <li key={recipe.id}>
              <article
                data-testid={`recipe-${recipe.id}`}
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-md border bg-bg-raised",
                  "transition-[transform,box-shadow,border-color] duration-[var(--dur)] ease-[var(--ease)]",
                  "hover:-translate-y-[3px] hover:border-gray hover:shadow-e1",
                  recipe.favorite ? "border-accent-ink" : "border-line",
                )}
              >
                {/* Photo upload is a separate story; the tile keeps its slot. */}
                <div className="relative aspect-[4/3] overflow-hidden bg-bg-raised-2">
                  <div
                    aria-hidden
                    className="size-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent),color-mix(in_srgb,var(--mint)_18%,transparent))] transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:scale-[1.04]"
                  />
                  {recipe.status === "DRAFT" && (
                    <span className="absolute top-3 left-3">
                      <Badge tone="neutral">{t("draft")}</Badge>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={
                      recipe.favorite
                        ? t("unpin", { title: recipe.title ?? t("untitled") })
                        : t("pin", { title: recipe.title ?? t("untitled") })
                    }
                    aria-pressed={recipe.favorite}
                    onClick={() => toggle(recipe)}
                    className={cn(
                      // Above the stretched link below, which covers the whole
                      // card and would otherwise swallow this click.
                      "absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full text-sm",
                      "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                      recipe.favorite
                        ? "bg-accent text-on-accent"
                        : "bg-[rgba(18,18,18,0.55)] text-[#f5f5f0] hover:bg-[rgba(18,18,18,0.75)]",
                    )}
                  >
                    {recipe.favorite ? "★" : "☆"}
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  {/* A heading, not a bare link: the grid is navigated by
                      heading in a screen reader. */}
                  <h3 className="font-display text-base font-bold text-text">
                    <Link
                      href={{
                        pathname: "/app/recipes/[id]",
                        params: { id: String(recipe.id) },
                      }}
                      className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
                    >
                      {recipe.title?.trim() || t("untitled")}
                    </Link>
                  </h3>

                  <p className="mt-1 text-[13px] font-semibold text-text-dim">
                    {t("meta", {
                      servings: recipe.servings,
                      minutes: recipe.minutes,
                    })}
                  </p>

                  {recipe.kcalPerServing !== null && (
                    <p className="tnum mt-2 font-mono text-[13px] text-gray">
                      {t("macros", {
                        kcal: recipe.kcalPerServing,
                        protein: recipe.proteinPerServing ?? 0,
                        carbs: recipe.carbsPerServing ?? 0,
                        fat: recipe.fatPerServing ?? 0,
                      })}
                      {recipe.estimated && (
                        <span
                          data-testid={`estimated-${recipe.id}`}
                          className="ml-2 text-coral-ink"
                        >
                          {t("estimated")}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
