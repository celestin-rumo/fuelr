"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Chip } from "@ui/chip";
import { FilterPanel, FilterTrigger } from "@ui/filter-group";
import { SEASONS, seasonOf } from "@app/lib/seasons";
import type { Season } from "@app/lib/seasons";
import { CUISINES } from "@app/lib/cuisines";
import type { Cuisine } from "@app/lib/cuisines";
import { ORIGINS } from "@app/lib/origins";
import type { RecipeOrigin } from "@app/lib/origins";

/** The tags the editor offers; the filter bar mirrors them exactly. */
const TAGS = [
  "vegetarian",
  "quick",
  "batch",
  "protein",
  "glutenFree",
  "cheap",
] as const;

const DEBOUNCE = 300;

/** The four doors, in the order somebody narrows a library: what, when, whence, where from. */
const GROUPS = ["tags", "seasons", "cuisines", "origins"] as const;
type Group = (typeof GROUPS)[number];

export type FilterState = {
  term: string;
  selectedTags: string[];
  selectedSeasons: Season[];
  selectedCuisines: Cuisine[];
  /** Where the recipes came from — a fact the code wrote, never a tag. */
  selectedOrigins: RecipeOrigin[];
  /** Only what the account's own preferences allow. */
  onlyCompatible: boolean;
  /** Resolved on the server, so "in season" means the same on both sides. */
  today: string;
};

/** How many filters are on — what the bar's button says on its face. */
export function activeCount(state: FilterState): number {
  return (
    state.selectedTags.length +
    state.selectedSeasons.length +
    state.selectedCuisines.length +
    state.selectedOrigins.length +
    (state.onlyCompatible ? 1 : 0)
  );
}

/**
 * The one way the filters reach the URL. Every part of the bar — the search
 * field, the drawer, the chips of what is on — writes through this, so no
 * part can forget another's state: the state is the page's props, and a
 * write carries all of it.
 */
function useFilterPush(state: FilterState) {
  const router = useRouter();
  const pathname = usePathname();
  return function push(
    nextTerm: string = state.term,
    nextTags: string[] = state.selectedTags,
    nextSeasons: Season[] = state.selectedSeasons,
    nextCuisines: Cuisine[] = state.selectedCuisines,
    nextOrigins: RecipeOrigin[] = state.selectedOrigins,
    nextCompatible: boolean = state.onlyCompatible,
  ) {
    const params = new URLSearchParams();
    if (nextTerm.trim()) params.set("q", nextTerm.trim());
    if (nextTags.length) params.set("tags", nextTags.join(","));
    if (nextSeasons.length) params.set("seasons", nextSeasons.join(","));
    if (nextCuisines.length) params.set("cuisines", nextCuisines.join(","));
    if (nextOrigins.length) params.set("origins", nextOrigins.join(","));
    if (nextCompatible) params.set("compatible", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
}

/** What toggling each domain does; shared by the drawer and the chips. */
function useToggles(state: FilterState) {
  const push = useFilterPush(state);
  const { selectedTags, selectedSeasons, selectedCuisines, selectedOrigins, onlyCompatible } = state;
  return {
    push,
    toggleTag(tag: string) {
      const next = selectedTags.includes(tag)
        ? selectedTags.filter((x) => x !== tag)
        : [...selectedTags, tag];
      push(undefined, next);
    },
    // Several means *either*, like the seasons — a recipe carries at most one
    // cuisine, so asking for two can only be a choice between them.
    toggleCuisine(cuisine: Cuisine) {
      const next = selectedCuisines.includes(cuisine)
        ? selectedCuisines.filter((x) => x !== cuisine)
        : [...selectedCuisines, cuisine];
      push(undefined, undefined, undefined, next);
    },
    // Alternatives too: a recipe has exactly one origin.
    toggleOrigin(origin: RecipeOrigin) {
      const next = selectedOrigins.includes(origin)
        ? selectedOrigins.filter((x) => x !== origin)
        : [...selectedOrigins, origin];
      push(undefined, undefined, undefined, undefined, next);
    },
    toggleSeason(season: Season) {
      const next = selectedSeasons.includes(season)
        ? selectedSeasons.filter((x) => x !== season)
        : [...selectedSeasons, season];
      push(undefined, undefined, next);
    },
    toggleCompatible() {
      push(undefined, undefined, undefined, undefined, undefined, !onlyCompatible);
    },
  };
}

/**
 * The search field alone, for the bar: it is the one filter somebody uses
 * on every visit, so it stays in reach while the rest is behind a button.
 */
export function RecipeSearch(state: FilterState) {
  const tApp = useTranslations("app");
  const push = useFilterPush(state);
  const [value, setValue] = useState(state.term);
  const firstRender = useRef(true);

  // Typing does not fire a request per keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => push(value), DEBOUNCE);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="search"
      aria-label={tApp("search.label")}
      placeholder={tApp("search.placeholder")}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      data-testid="recipe-search"
      className="min-h-11 w-full rounded-sm border border-line bg-bg-raised-2 px-4 text-[15px] font-medium text-text placeholder:text-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
    />
  );
}

/**
 * What is on, by name, removable one by one — outside the drawer, so a
 * filter behind a shut door is never a forgotten one. Nothing while
 * nothing is on.
 */
export function ActiveFilters(state: FilterState) {
  const t = useTranslations("recipe");
  const tApp = useTranslations("app");
  const { push, toggleTag, toggleSeason, toggleCuisine, toggleOrigin, toggleCompatible } =
    useToggles(state);
  const { selectedTags, selectedSeasons, selectedCuisines, selectedOrigins, onlyCompatible } = state;
  if (activeCount(state) === 0 && state.term === "") return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="active-filters">
      {selectedTags.map((tag) => (
        <Chip
          key={`on-${tag}`}
          active
          onRemove={() => toggleTag(tag)}
          removeLabel={t("filters.remove", { name: t(`tags.${tag}`) })}
        >
          {t(`tags.${tag}`)}
        </Chip>
      ))}
      {selectedSeasons.map((season) => (
        <Chip
          key={`on-${season}`}
          active
          onRemove={() => toggleSeason(season)}
          removeLabel={t("filters.remove", { name: t(`seasons.${season}`) })}
        >
          {t(`seasons.${season}`)}
        </Chip>
      ))}
      {selectedCuisines.map((cuisine) => (
        <Chip
          key={`on-${cuisine}`}
          active
          onRemove={() => toggleCuisine(cuisine)}
          removeLabel={t("filters.remove", { name: t(`cuisines.${cuisine}`) })}
        >
          {t(`cuisines.${cuisine}`)}
        </Chip>
      ))}
      {selectedOrigins.map((origin) => (
        <Chip
          key={`on-${origin}`}
          active
          onRemove={() => toggleOrigin(origin)}
          removeLabel={t("filters.remove", { name: t(`origins.${origin}`) })}
        >
          {t(`origins.${origin}`)}
        </Chip>
      ))}
      {onlyCompatible && (
        <Chip
          active
          onRemove={toggleCompatible}
          removeLabel={t("filters.remove", { name: t("filters.compatible") })}
        >
          {t("filters.compatible")}
        </Chip>
      )}
      <Chip onClick={() => push("", [], [], [], [], false)}>{tApp("search.clear")}</Chip>
    </div>
  );
}

/**
 * The library's filters, the way a shop's listing draws them — inside the
 * drawer the bar opens.
 *
 * A row of *popular* filters first — the handful people actually press:
 * in season, quick, vegetarian, what my preferences allow, what a model
 * wrote — then four doors, one per closed domain, each saying on its face
 * how many of its options are on. Opening one lays its options out under
 * the row; opening another closes it. What is on is named outside the
 * drawer, by `ActiveFilters`, so a filter behind a shut drawer is never a
 * forgotten one: the bar's button counts it and the chip names it.
 */
export function RecipeFilters(state: FilterState) {
  const t = useTranslations("recipe");
  const { push, toggleTag, toggleSeason, toggleCuisine, toggleOrigin, toggleCompatible } =
    useToggles(state);
  const { selectedTags, selectedSeasons, selectedCuisines, selectedOrigins, onlyCompatible, today } =
    state;
  /** The one door open, if any. */
  const [open, setOpen] = useState<Group | null>(null);

  const current = seasonOf(today);
  const onlyCurrent = selectedSeasons.length === 1 && selectedSeasons[0] === current;

  const counts: Record<Group, number> = {
    tags: selectedTags.length,
    seasons: selectedSeasons.length,
    cuisines: selectedCuisines.length,
    origins: selectedOrigins.length,
  };

  function door(group: Group) {
    setOpen((now) => (now === group ? null : group));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The handful people actually press, always in reach. Each is the
          same filter as behind its door, so the door counts it too. */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("filters.popular")}
        </p>
        <div className="flex flex-wrap gap-2" data-testid="popular-filters">
          <Chip
            active={onlyCurrent}
            data-testid="in-season"
            onClick={() => push(undefined, undefined, onlyCurrent ? [] : [current])}
          >
            {t("seasons.now")}
          </Chip>
          <Chip active={selectedTags.includes("quick")} onClick={() => toggleTag("quick")}>
            {t("tags.quick")}
          </Chip>
          <Chip
            active={selectedTags.includes("vegetarian")}
            onClick={() => toggleTag("vegetarian")}
          >
            {t("tags.vegetarian")}
          </Chip>
          {/* The account's own diet and allergens, applied to the library the
              way the planner applies them to a model's answer: on the lines. */}
          <Chip active={onlyCompatible} data-testid="compatible-filter" onClick={toggleCompatible}>
            {t("filters.compatible")}
          </Chip>
          <Chip active={selectedOrigins.includes("AI")} onClick={() => toggleOrigin("AI")}>
            {t("origins.AI")}
          </Chip>
        </div>
      </div>

      {/* Four doors, two to a row: the drawer is never wider than a phone. */}
      <div className="grid grid-cols-2 gap-2">
        {GROUPS.map((group) => (
          <FilterTrigger
            key={group}
            id={`filter-${group}-trigger`}
            aria-controls={`${group}-panel`}
            data-testid={`filter-${group}`}
            count={counts[group]}
            open={open === group}
            onClick={() => door(group)}
          >
            {t(`filters.groups.${group}`)}
          </FilterTrigger>
        ))}
      </div>

      {open === "tags" && (
        <FilterPanel id="tags-panel" labelledBy="filter-tags-trigger" data-testid="tag-filters">
          {TAGS.map((tag) => (
            <Chip key={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)}>
              {t(`tags.${tag}`)}
            </Chip>
          ))}
        </FilterPanel>
      )}

      {open === "seasons" && (
        <FilterPanel id="seasons-panel" labelledBy="filter-seasons-trigger" data-testid="season-filters">
          {SEASONS.map((season) => (
            <Chip
              key={season}
              active={selectedSeasons.includes(season)}
              onClick={() => toggleSeason(season)}
            >
              {t(`seasons.${season}`)}
            </Chip>
          ))}
        </FilterPanel>
      )}

      {open === "cuisines" && (
        <FilterPanel id="cuisines-panel" labelledBy="filter-cuisines-trigger" data-testid="cuisine-filters">
          {CUISINES.map((cuisine) => (
            <Chip
              key={cuisine}
              active={selectedCuisines.includes(cuisine)}
              onClick={() => toggleCuisine(cuisine)}
            >
              {t(`cuisines.${cuisine}`)}
            </Chip>
          ))}
        </FilterPanel>
      )}

      {/* Where a recipe came from. Written by the code and never by the
          editor, which is exactly why it is worth being able to look for. */}
      {open === "origins" && (
        <FilterPanel id="origins-panel" labelledBy="filter-origins-trigger" data-testid="origin-filters">
          {ORIGINS.map((origin) => (
            <Chip
              key={origin}
              active={selectedOrigins.includes(origin)}
              onClick={() => toggleOrigin(origin)}
            >
              {t(`origins.${origin}`)}
            </Chip>
          ))}
        </FilterPanel>
      )}
    </div>
  );
}
