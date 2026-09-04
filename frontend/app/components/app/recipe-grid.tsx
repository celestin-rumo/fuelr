"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { cn } from "@ui/cn";
import type { RecipeSummary } from "@app/lib/api";
import type { Season } from "@app/lib/seasons";
import {
  deleteRecipe,
  duplicateRecipe,
  moveFavorite,
  setFavorite,
} from "@app/[locale]/(app)/app/recipes/actions";
import { RecipeFilters } from "./recipe-filters";
import { Button, IconButton, buttonClasses } from "@ui/button";
import { Dialog } from "@ui/dialog";
import { Icon } from "@ui/icons";
import { ListRow, ListRowActions } from "@ui/list-row";
import { Menu } from "@ui/menu";
import { Segmented, SegmentedCount } from "@ui/segmented";
import { Pagination } from "@ui/pagination";
import { Banner } from "@ui/banner";
import { PlanDialog } from "./plan-dialog";

/**
 * The backend already returns the library in order — pinned first, in the
 * chosen rank. This only re-applies the favourite split so an optimistic pin
 * moves the card immediately, without waiting for the refetch.
 */
/** How many rows a page holds. Six is what fits a phone without scrolling. */
const PER_PAGE = 6;

function sorted(recipes: RecipeSummary[]) {
  return [...recipes].sort((a, b) => Number(b.favorite) - Number(a.favorite));
}

export function RecipeGrid({
  recipes,
  term,
  selectedTags,
  selectedSeasons,
  today,
}: {
  recipes: RecipeSummary[];
  term: string;
  selectedTags: string[];
  selectedSeasons: Season[];
  /** Resolved on the server: "in season" must not depend on the browser. */
  today: string;
}) {
  const t = useTranslations("app");
  const [confirming, setConfirming] = useState<RecipeSummary | null>(null);
  const [planning, setPlanning] = useState<RecipeSummary | null>(null);
  const [planned, setPlanned] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(0);
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

  const matching = sorted(optimistic).filter((r) => !onlyFavorites || r.favorite);
  const favoriteCount = optimistic.filter((r) => r.favorite).length;

  /*
   * Six a page. A library of two hundred recipes is not a decision anybody
   * makes by scrolling: the filters above are how it is narrowed, and the
   * page is how what is left is read. Clamped rather than trusted, because
   * the last page disappears the moment a filter removes a row and the state
   * would otherwise point past the end.
   */
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  function move(recipe: RecipeSummary, direction: -1 | 1) {
    startTransition(async () => {
      const result = await moveFavorite(recipe.id, direction);
      if (result.ok) router.refresh();
    });
  }

  function duplicate(recipe: RecipeSummary) {
    startTransition(async () => {
      const result = await duplicateRecipe(recipe.id, t("copySuffix"));
      if (result.ok) router.refresh();
    });
  }

  function confirmDelete(recipe: RecipeSummary) {
    startTransition(async () => {
      const result = await deleteRecipe(recipe.id);
      setConfirming(null);
      if (result.ok) router.refresh();
    });
  }

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
      <RecipeFilters
        term={term}
        selectedTags={selectedTags}
        selectedSeasons={selectedSeasons}
        today={today}
      />

      {/* One among two, so it is the segmented control and not two chips: a
          chip is a filter you stack, and these two are exclusive. */}
      <Segmented
        label={t("filters.label")}
        value={onlyFavorites ? "favorites" : "all"}
        onChange={(which) => setOnlyFavorites(which === "favorites")}
        options={[
          { value: "all", label: t("filters.all") },
          {
            value: "favorites",
            label: t("filters.favorites"),
            affix: (
              <SegmentedCount count={favoriteCount} on={onlyFavorites} />
            ),
          },
        ]}
      />

      {shown.length === 0 ? (
        <p data-testid="no-results" className="text-[15px] font-medium text-text-dim">
          {onlyFavorites ? t("filters.noFavorites") : t("search.noResults")}
        </p>
      ) : (
        // A list, not a gallery. The photograph took three quarters of a card
        // and most recipes have none, so it was usually a decorative gradient
        // fitting one recipe and a half on a phone; a list fits six. The photo
        // has not left the application — it is on the recipe, where it is of
        // something.
        <ul data-testid="recipe-grid" className="flex flex-col gap-2">
          {shown.map((recipe, onPage) => {
            const title = recipe.title?.trim() || t("untitled");
            // Position in the whole filtered list, not on this page: "first
            // favourite" must not become true again at the top of page two.
            const index = current * PER_PAGE + onPage;
            return (
              <ListRow
                as="li"
                key={recipe.id}
                data-testid={`recipe-${recipe.id}`}
                interactive
                selected={recipe.favorite}
                trailing={
                  <ListRowActions>
                    {/*
                     * The two things somebody opens the library to do are
                     * visible; the rest is one press away. Seven controls in
                     * a rail is 308px of buttons on a 360px screen, and the
                     * two that matter most would have been the ones to wrap.
                     */}
                    <Link
                      aria-label={t("cook", { title })}
                      href={{
                        pathname: "/app/recipes/[id]/cook",
                        params: { id: String(recipe.id) },
                      }}
                      className={buttonClasses({
                        variant: "quiet",
                        size: "none",
                        className: "relative z-10 h-11 w-11 shrink-0 p-0",
                      })}
                    >
                      <Icon name="flame" />
                    </Link>
                    <IconButton
                      aria-label={t("plan.action", { title })}
                      variant="quiet"
                      className="relative z-10"
                      onClick={() => setPlanning(recipe)}
                    >
                      <Icon name="calendarPlus" />
                    </IconButton>
                    <Menu
                      label={t("more", { title })}
                      items={[
                        {
                          label: t("editShort"),
                          icon: "pencil",
                          testId: `edit-${recipe.id}`,
                          onSelect: () =>
                            router.push({
                              pathname: "/app/recipes/[id]",
                              params: { id: String(recipe.id) },
                            }),
                        },
                        {
                          label: t("duplicateShort"),
                          icon: "copy",
                          onSelect: () => duplicate(recipe),
                        },
                        // Reordering only applies to a pinned recipe, so on
                        // every other row it is disabled inside the menu
                        // rather than missing from it: an item that comes and
                        // goes moves every item after it.
                        {
                          label: t("moveUpShort"),
                          icon: "arrowUp",
                          disabled: !recipe.favorite || index === 0,
                          onSelect: () => move(recipe, -1),
                        },
                        {
                          label: t("moveDownShort"),
                          icon: "arrowDown",
                          disabled:
                            !recipe.favorite || index === favoriteCount - 1,
                          onSelect: () => move(recipe, 1),
                        },
                        {
                          label: t("deleteShort"),
                          icon: "trash",
                          destructive: true,
                          onSelect: () => setConfirming(recipe),
                        },
                      ]}
                    />
                  </ListRowActions>
                }
                leading={
                  <button
                    type="button"
                    aria-label={
                      recipe.favorite
                        ? t("unpin", { title })
                        : t("pin", { title })
                    }
                    aria-pressed={recipe.favorite}
                    onClick={() => toggle(recipe)}
                    className={cn(
                      // Above the stretched link below, which covers the whole
                      // row and would otherwise swallow this click.
                      "relative z-10 grid size-11 shrink-0 place-items-center rounded-full",
                      "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                      recipe.favorite
                        ? "text-accent-ink"
                        : "text-gray hover:text-text",
                    )}
                  >
                    <Icon name="star" size={20} filled={recipe.favorite} />
                  </button>
                }
              >
                {/* A heading, not a bare link: the library is navigated by
                    heading in a screen reader. */}
                <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-text">
                  <Link
                    href={{
                      pathname: "/app/recipes/[id]",
                      params: { id: String(recipe.id) },
                    }}
                    className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
                  >
                    {title}
                  </Link>
                </h3>

                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-text-dim">
                  <span>
                    {t("meta", {
                      servings: recipe.servings,
                      minutes: recipe.minutes,
                    })}
                  </span>
                  {recipe.kcalPerServing !== null && (
                    <span className="tnum font-mono text-gray">
                      ·{" "}
                      {t("macros", {
                        kcal: recipe.kcalPerServing,
                        protein: recipe.proteinPerServing ?? 0,
                        carbs: recipe.carbsPerServing ?? 0,
                        fat: recipe.fatPerServing ?? 0,
                      })}
                    </span>
                  )}
                  {recipe.estimated && recipe.kcalPerServing !== null && (
                    <span
                      data-testid={`estimated-${recipe.id}`}
                      className="text-coral-ink"
                    >
                      {t("estimated")}
                    </span>
                  )}
                  {recipe.status === "DRAFT" && (
                    <Badge tone="neutral">{t("draft")}</Badge>
                  )}
                </p>
              </ListRow>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <Pagination
          page={current}
          pages={pages}
          onChange={setPage}
          labels={{
            nav: t("pagination.label"),
            previous: t("pagination.previous"),
            next: t("pagination.next"),
            position: t("pagination.position", {
              page: current + 1,
              pages,
              total: matching.length,
            }),
          }}
        />
      )}

      {planned && (
        <Banner
          tone="success"
          data-testid="planned"
          onDismiss={() => setPlanned(null)}
          dismissLabel={t("plan.dismiss")}
          action={
            <Link
              href="/app/plan"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("plan.open")}
            </Link>
          }
        >
          {planned}
        </Banner>
      )}

      {planning && (
        <PlanDialog
          recipe={planning}
          today={today}
          onClose={() => setPlanning(null)}
          onPlanned={(message) => {
            setPlanning(null);
            setPlanned(message);
          }}
        />
      )}

      {confirming && (
        <Dialog
          title={t("deleteConfirm.title", {
            title: confirming.title?.trim() || t("untitled"),
          })}
          closeLabel={t("deleteConfirm.close")}
          onClose={() => setConfirming(null)}
        >
          <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("deleteConfirm.body")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="danger" onClick={() => confirmDelete(confirming)}>
              {t("deleteConfirm.confirm")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              {t("deleteConfirm.cancel")}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
