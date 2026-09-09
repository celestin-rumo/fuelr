"use client";

import { useRef, useState, useTransition } from "react";
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
import { askLive } from "@app/lib/ideas-stream";
import { preloadIllustration } from "@app/lib/use-illustration";
import type { Progress } from "@app/lib/ideas-stream";
import { draftFromIdea, addMissingToList } from "@app/[locale]/(app)/app/menu/actions";
import { WorkingOn } from "./working-on";
import type { Step } from "./working-on";
import { IdeaThumb, RecipeThumb } from "./recipe-thumb";

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
  const [progress, setProgress] = useState<Progress | null>(null);
  /** Writing dish n, then drawing its picture once it is written. */
  const [step, setStep] = useState<Step | null>(null);
  /** Pictures already fetched, so the rows paint with them rather than after them. */
  const [ready, setReady] = useState<Set<string>>(new Set());
  /** Pictures finished, drawn or given up on: the second half of the bar. */
  const [drawn, setDrawn] = useState(0);
  const [pending, startTransition] = useTransition();
  /** The ask in flight, so "Annuler" can close it. */
  const asking = useRef<AbortController | null>(null);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!have.trim()) {
      setError(t("errors.empty"));
      return;
    }
    setError(null);
    setAdded(null);
    setAnswer(null);
    setProgress(null);
    setStep(null);
    setReady(new Set());
    setDrawn(0);
    setSearching(true);
    const controller = new AbortController();
    asking.current = controller;

    // Each picture is fetched as its dish is written, and the answer waits
    // for all of them: the ideas then appear together, illustrated, rather
    // than as rows that fill in one after another under the reader's eyes.
    const pictures: Promise<void>[] = [];
    const found: Suggestion[] = [];

    const result = await askLive<Suggestions, Suggestion>(
      "/api/menu/suggestions",
      { have: have.trim() },
      (told) => {
        setProgress(told);
        setStep({ index: told.done, phase: "writing" });
      },
      (arrival) => {
        // Kept only so a cancelled ask can still show what was written and
        // paid for; nothing is put on screen until every picture is in.
        found.push(arrival.dish);
        const key = arrival.dish.illustrationKey;
        if (!key) return;
        setStep({ index: arrival.index, phase: "drawing" });
        pictures.push(
          preloadIllustration(key, controller.signal).then((drawn) => {
            if (drawn) setReady((keys) => new Set(keys).add(key));
            setDrawn((count) => count + 1);
          }),
        );
      },
      controller.signal,
    );
    asking.current = null;

    if (!result.ok) {
      setSearching(false);
      // Cancelled is not failed. What was written was paid for, so it is
      // shown; its pictures catch up on their own.
      if (result.cancelled) {
        if (found.length > 0) setAnswer({ suggestions: found, assisted: true });
        return;
      }
      setError(t("errors.failed"));
      return;
    }

    await Promise.all(pictures);
    setSearching(false);
    setAnswer(result.result);
  }

  function cancel() {
    asking.current?.abort();
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
          {/* The button does not spin: the panel below says what is
              happening. While an ask is in flight, the one thing to offer is
              the way out of it. */}
          {searching ? (
            <Button type="button" variant="secondary" size="lg" onClick={cancel} data-testid="cancel-ask">
              {t("cancel")}
            </Button>
          ) : (
            <Button type="submit" size="lg" data-testid="ask">
              {t("submit")}
            </Button>
          )}
        </form>
      </Card>

      {/* What was typed is what turns: the chicken and the carrot, while
          the library is searched and a model writes the rest. */}
      {searching && (
        <WorkingOn
          data-testid="working"
          label={t("working")}
          words={have}
          progress={progress}
          step={step}
          drawn={drawn}
        />
      )}

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
                ready={ready.has(suggestion.illustrationKey ?? "")}
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
  ready = false,
}: {
  suggestion: Suggestion;
  onKeep: () => void;
  onShop: () => void;
  /** Its picture was fetched before this row was shown. */
  ready?: boolean;
}) {
  const t = useTranslations("menu");
  const own = suggestion.origin === "RECIPE";

  return (
    <ListRow
      as="li"
      selected={own}
      leading={
        own && suggestion.recipeId != null ? (
          <RecipeThumb id={suggestion.recipeId} title={suggestion.title} hasPhoto={suggestion.hasPhoto} />
        ) : (
          <IdeaThumb
            illustrationKey={suggestion.illustrationKey}
            title={suggestion.title}
            ready={ready}
          />
        )
      }
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
