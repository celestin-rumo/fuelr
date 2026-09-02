"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Chip } from "@ui/chip";
import { Input } from "@ui/input";
import { SEASONS, seasonOf } from "@app/lib/seasons";
import type { Season } from "@app/lib/seasons";

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
  today,
}: {
  term: string;
  selectedTags: string[];
  selectedSeasons: Season[];
  /** Resolved on the server, so "in season" means the same on both sides. */
  today: string;
}) {
  const t = useTranslations("recipe");
  const tApp = useTranslations("app");
  const router = useRouter();
  const pathname = usePathname();

  const [value, setValue] = useState(term);
  const firstRender = useRef(true);

  function push(nextTerm: string, nextTags: string[], nextSeasons: Season[]) {
    const params = new URLSearchParams();
    if (nextTerm.trim()) params.set("q", nextTerm.trim());
    if (nextTags.length) params.set("tags", nextTags.join(","));
    if (nextSeasons.length) params.set("seasons", nextSeasons.join(","));
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

  function toggleSeason(season: Season) {
    const next = selectedSeasons.includes(season)
      ? selectedSeasons.filter((x) => x !== season)
      : [...selectedSeasons, season];
    push(value, selectedTags, next);
  }

  const current = seasonOf(today);
  const onlyCurrent =
    selectedSeasons.length === 1 && selectedSeasons[0] === current;

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
        {(selectedTags.length > 0 || selectedSeasons.length > 0 || value !== "") && (
          <Chip
            onClick={() => {
              setValue("");
              push("", [], []);
            }}
          >
            {tApp("search.clear")}
          </Chip>
        )}
      </div>
    </div>
  );
}
