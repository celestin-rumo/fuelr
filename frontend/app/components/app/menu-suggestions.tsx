"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { Banner } from "@ui/banner";
import { Button, buttonClasses } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";
import { Link } from "@/i18n/navigation";
import { Menu } from "@ui/menu";
import {
  ListRow,
  ListRowActions,
  ListRowMeta,
  ListRowTitle,
} from "@ui/list-row";
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
          {/* The same list the library uses. A suggestion is read the way a
              recipe is read — title, time, what it would cost to make — and
              two ways of drawing that is one way too many. It also settles
              the illustration question honestly: no row anywhere in this app
              carries a photograph, so an idea is not made to look like it is
              missing one. */}
          <ul data-testid="suggestions" className="flex flex-col gap-2">
            {answer.suggestions.map((suggestion, index) => (
              <SuggestionRow
                key={`${suggestion.title}-${index}`}
                suggestion={suggestion}
                onKeep={() => keep(suggestion)}
                onShop={() => shop(suggestion)}
              />
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

function SuggestionRow({
  suggestion,
  onKeep,
  onShop,
}: {
  suggestion: Suggestion;
  onKeep: () => void;
  onShop: () => void;
}) {
  const t = useTranslations("menu");
  const own = suggestion.origin === "RECIPE";

  return (
    <ListRow
      as="li"
      selected={own}
      trailing={
        <ListRowActions className="gap-2">
          {own ? (
            <Link
              href={{
                pathname: "/app/recipes/[id]",
                params: { id: String(suggestion.recipeId) },
              }}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("open")}
            </Link>
          ) : (
            <Button variant="secondary" size="sm" onClick={onKeep}>
              {t("keep")}
            </Button>
          )}
          {suggestion.missing.length > 0 && (
            <Menu
              label={t("more", { title: suggestion.title })}
              items={[
                {
                  label: t("addMissing"),
                  icon: "cart",
                  onSelect: onShop,
                },
              ]}
            />
          )}
        </ListRowActions>
      }
    >
      <ListRowTitle className="flex flex-wrap items-center gap-2">
        {suggestion.title}
        <Badge tone={own ? "accent" : "neutral"}>
          {own ? t("yours") : t("idea")}
        </Badge>
      </ListRowTitle>
      <ListRowMeta>
        {suggestion.minutes != null && (
          <span className="tnum font-mono text-gray">
            {t("minutes", { count: suggestion.minutes })}
            {" · "}
          </span>
        )}
        {suggestion.missing.length === 0
          ? t("nothingMissing")
          : t("missing", { items: suggestion.missing.join(", ") })}
      </ListRowMeta>
    </ListRow>
  );
}
