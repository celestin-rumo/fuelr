"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";
import type { Suggestion, Suggestions } from "@app/lib/api";
import { draftFromIdea, addMissingToList } from "@app/[locale]/(app)/app/menu/actions";

/**
 * What to cook, from what is in the bag.
 *
 * Every suggestion is illustrated, and where the illustration comes from is
 * the honest part. A recipe the cook already wrote shows its own photograph.
 * An idea has none — and rather than generate one, it gets a tile drawn from
 * its own title, so two ideas never look alike and none of them pretends to be
 * a photograph of a dish somebody cooked.
 */
export function MenuSuggestions({ week }: { week: string }) {
  const t = useTranslations("menu");
  const locale = useLocale();
  const router = useRouter();

  const [have, setHave] = useState("");
  const [answer, setAnswer] = useState<Suggestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!have.trim()) {
      setError(t("errors.empty"));
      return;
    }
    setError(null);
    setAdded(null);
    setSearching(true);
    const response = await fetch("/api/menu/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ have: have.trim() }),
    });
    setSearching(false);
    if (!response.ok) {
      setError(t("errors.failed"));
      return;
    }
    setAnswer((await response.json()) as Suggestions);
  }

  /** An idea becomes a draft to correct — never a recipe in the library. */
  function keep(suggestion: Suggestion) {
    startTransition(async () => {
      const result = await draftFromIdea(suggestion);
      if (!result.ok) {
        setError(t("errors.failed"));
        return;
      }
      router.push({
        pathname: "/app/recipes/[id]",
        params: { id: String(result.id) },
      });
    });
  }

  function shop(suggestion: Suggestion) {
    startTransition(async () => {
      const result = await addMissingToList(week, suggestion.missing);
      if (!result.ok) {
        setError(t("errors.failed"));
        return;
      }
      setAdded(suggestion.title);
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-[0.9]")}>
      <Card as="panel">
        <form className="flex flex-wrap items-end gap-3" onSubmit={ask}>
          <div className="min-w-[16rem] flex-1">
            <Input
              label={t("field")}
              placeholder={t("placeholder")}
              value={have}
              onChange={(event) => {
                setHave(event.target.value);
                setError(null);
              }}
              status={error ? "error" : "default"}
            />
          </div>
          <Button type="submit" size="lg" loading={searching} data-testid="ask">
            {searching ? t("searching") : t("submit")}
          </Button>
        </form>
      </Card>

      {error && (
        <Banner tone="error" data-testid="menu-error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {added && (
        <Banner tone="success" data-testid="added" onDismiss={() => setAdded(null)}>
          {t("added")}
        </Banner>
      )}

      {answer && answer.suggestions.length === 0 && (
        <p data-testid="menu-empty" className="text-[15px] font-medium text-text-dim">
          {t("empty")}
        </p>
      )}

      {answer && answer.suggestions.length > 0 && (
        <>
          <ul
            data-testid="suggestions"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {answer.suggestions.map((suggestion, index) => (
              <li key={`${suggestion.title}-${index}`}>
                <SuggestionCard
                  suggestion={suggestion}
                  locale={locale}
                  onKeep={() => keep(suggestion)}
                  onShop={() => shop(suggestion)}
                />
              </li>
            ))}
          </ul>

          {answer.assisted && (
            <p className="text-[12px] font-medium text-gray">{t("assisted")}</p>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  locale,
  onKeep,
  onShop,
}: {
  suggestion: Suggestion;
  locale: string;
  onKeep: () => void;
  onShop: () => void;
}) {
  const t = useTranslations("menu");
  const own = suggestion.origin === "RECIPE";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-md border border-line bg-bg-raised">
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-raised-2">
        {own && suggestion.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/recipes/${suggestion.recipeId}/photo`}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <Tile title={suggestion.title} />
        )}
        <span className="absolute top-3 left-3">
          <Badge tone={own ? "accent" : "neutral"}>
            {own ? t("yours") : t("idea")}
          </Badge>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-display text-base font-bold text-text">{suggestion.title}</h2>

        {suggestion.minutes != null && (
          <p className="tnum font-mono text-[13px] text-gray">
            {t("minutes", { count: suggestion.minutes })}
          </p>
        )}

        <p className="text-[13px] font-medium text-text-dim">
          {suggestion.missing.length === 0
            ? t("nothingMissing")
            : t("missing", { items: suggestion.missing.join(", ") })}
        </p>

        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {own ? (
            <a
              href={`/${locale}/app/recettes/${suggestion.recipeId}`}
              className="text-[13px] font-semibold text-mint-ink hover:underline"
            >
              {t("open")}
            </a>
          ) : (
            <Button variant="secondary" size="sm" onClick={onKeep}>
              {t("keep")}
            </Button>
          )}

          {suggestion.missing.length > 0 && (
            <Button variant="text" size="sm" onClick={onShop}>
              {t("addMissing")}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * An illustration for a dish that has no photograph.
 *
 * Drawn from the title, so two ideas never look alike and the same idea looks
 * the same twice. It is deliberately not a picture of food: generating one
 * would put a photograph of a dish nobody cooked next to photographs of dishes
 * somebody did, which is the one thing this application does not do with a
 * guess.
 */
function Tile({ title }: { title: string }) {
  const hue = [...title].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      aria-hidden
      className="grid size-full place-items-center"
      style={{
        background: `linear-gradient(135deg,
          color-mix(in srgb, hsl(${hue} 70% 55%) 26%, transparent),
          color-mix(in srgb, hsl(${(hue + 40) % 360} 70% 55%) 18%, transparent))`,
      }}
    >
      <span className="font-display text-[28px] font-extrabold text-text opacity-45">
        {initials}
      </span>
    </div>
  );
}
