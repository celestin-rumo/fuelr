"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Chip } from "@ui/chip";
import { cn } from "@ui/cn";
import { Input } from "@ui/input";
import { SEASONS, seasonOf } from "@app/lib/seasons";
import type { Season } from "@app/lib/seasons";
import { CUISINES } from "@app/lib/cuisines";
import type { Cuisine } from "@app/lib/cuisines";

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

export function RecipeFilters({
  term,
  selectedTags,
  selectedSeasons,
  selectedCuisines,
  today,
}: {
  term: string;
  selectedTags: string[];
  selectedSeasons: Season[];
  selectedCuisines: Cuisine[];
  /** Resolved on the server, so "in season" means the same on both sides. */
  today: string;
}) {
  const t = useTranslations("recipe");
  const tApp = useTranslations("app");
  const router = useRouter();
  const pathname = usePathname();

  const [value, setValue] = useState(term);
  const firstRender = useRef(true);

  function push(
    nextTerm: string,
    nextTags: string[],
    nextSeasons: Season[],
    nextCuisines: Cuisine[] = selectedCuisines,
  ) {
    const params = new URLSearchParams();
    if (nextTerm.trim()) params.set("q", nextTerm.trim());
    if (nextTags.length) params.set("tags", nextTags.join(","));
    if (nextSeasons.length) params.set("seasons", nextSeasons.join(","));
    if (nextCuisines.length) params.set("cuisines", nextCuisines.join(","));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  // Typing does not fire a request per keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(
      () => push(value, selectedTags, selectedSeasons),
      DEBOUNCE,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((x) => x !== tag)
      : [...selectedTags, tag];
    push(value, next, selectedSeasons);
  }

  // Several means *either*, like the seasons — a recipe carries at most one
  // cuisine, so asking for two can only be a choice between them.
  function toggleCuisine(cuisine: Cuisine) {
    const next = selectedCuisines.includes(cuisine)
      ? selectedCuisines.filter((x) => x !== cuisine)
      : [...selectedCuisines, cuisine];
    push(value, selectedTags, selectedSeasons, next);
  }

  function toggleSeason(season: Season) {
    const next = selectedSeasons.includes(season)
      ? selectedSeasons.filter((x) => x !== season)
      : [...selectedSeasons, season];
    push(value, selectedTags, next);
  }

  const current = seasonOf(today);
  const onlyCurrent =
    selectedSeasons.length === 1 && selectedSeasons[0] === current;

  // Eleven rows of chips stood between somebody opening the app and seeing a
  // single recipe. They fold on a phone and are open at every other width;
  // the count on the button is what keeps a hidden filter from being a
  // forgotten one.
  const active =
    selectedTags.length + selectedSeasons.length + selectedCuisines.length;
  // Always shut to begin with, even arriving from a filtered link: the chips
  // above already say what is on, and opening the panel as well would put the
  // same state on screen twice while costing everybody the tab stops.
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-md">
        <Input
          label={tApp("search.label")}
          type="search"
          value={value}
          placeholder={tApp("search.placeholder")}
          onChange={(e) => setValue(e.target.value)}
          hint={tApp("search.hint")}
        />
      </div>

      {/*
       * Folded at every width, not only on a phone.
       *
       * Twenty-three chips — six tags, five seasons, twelve cuisines — stood
       * between somebody opening the app and seeing a recipe, and every one of
       * them is a tab stop for anybody who does not use a mouse. The library
       * is what people came for; the filters are how they narrow it once they
       * are here.
       *
       * The rule that makes hiding them allowed is that a hidden filter still
       * has to say it is on — so what is active stays out here, as chips that
       * can be removed one by one. That is stronger than the count it replaces:
       * you can see *which* filter is on, and undo it without opening
       * anything.
       */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={active > 0}
          count={active > 0 ? active : undefined}
          aria-expanded={open}
          aria-controls="recipe-filters"
          data-testid="toggle-filters"
          onClick={() => setOpen((current) => !current)}
        >
          {t("filters.toggle")}
        </Chip>

        {/* Only while the panel is shut: open, the panel itself says what is
            on, and two copies of the same state is two places to tab through. */}
        {!open &&
          selectedTags.map((tag) => (
            <Chip
              key={`on-${tag}`}
              active
              onRemove={() => toggleTag(tag)}
              removeLabel={t("filters.remove", { name: t(`tags.${tag}`) })}
              onClick={() => setOpen(true)}
            >
              {t(`tags.${tag}`)}
            </Chip>
          ))}
        {!open &&
          selectedSeasons.map((season) => (
            <Chip
              key={`on-${season}`}
              active
              onRemove={() => toggleSeason(season)}
              removeLabel={t("filters.remove", { name: t(`seasons.${season}`) })}
              onClick={() => setOpen(true)}
            >
              {t(`seasons.${season}`)}
            </Chip>
          ))}
        {!open &&
          selectedCuisines.map((cuisine) => (
            <Chip
              key={`on-${cuisine}`}
              active
              onRemove={() => toggleCuisine(cuisine)}
              removeLabel={t("filters.remove", { name: t(`cuisines.${cuisine}`) })}
              onClick={() => setOpen(true)}
            >
              {t(`cuisines.${cuisine}`)}
            </Chip>
          ))}
      </div>

      <div
        id="recipe-filters"
        className={cn("flex-col gap-4", open ? "flex" : "hidden")}
      >
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tag) => (
          <Chip
            key={tag}
            active={selectedTags.includes(tag)}
            onClick={() => toggleTag(tag)}
          >
            {t(`tags.${tag}`)}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" data-testid="season-filters">
        {/* One tap for the common case, next to the four it is made of — it
            selects the season, it does not hide the others. */}
        <Chip
          active={onlyCurrent}
          data-testid="in-season"
          onClick={() => push(value, selectedTags, onlyCurrent ? [] : [current])}
        >
          {t("seasons.now")}
        </Chip>
        {SEASONS.map((season) => (
          <Chip
            key={season}
            active={selectedSeasons.includes(season)}
            onClick={() => toggleSeason(season)}
          >
            {t(`seasons.${season}`)}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" data-testid="cuisine-filters">
        {CUISINES.map((cuisine) => (
          <Chip
            key={cuisine}
            active={selectedCuisines.includes(cuisine)}
            onClick={() => toggleCuisine(cuisine)}
          >
            {t(`cuisines.${cuisine}`)}
          </Chip>
        ))}
        {(active > 0 || value !== "") && (
          <Chip
            onClick={() => {
              setValue("");
              push("", [], [], []);
            }}
          >
            {tApp("search.clear")}
          </Chip>
        )}
      </div>
      </div>
    </div>
  );
}
