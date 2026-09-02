"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, IconButton, buttonClasses } from "@ui/button";
import { cn } from "@ui/cn";
import type { Recipe } from "@app/lib/api";
import { cookableSteps } from "@app/lib/cooking";
import { CookingIngredients } from "./cooking-ingredients";

/**
 * Cooking mode: one step per screen, and nothing that needs a precise gesture.
 *
 * It reads the recipe and never writes to it. That is what lets it work with
 * no network later, and what makes it safe to scale the quantities on screen
 * without touching what the author wrote.
 */
export function CookingMode({ recipe }: { recipe: Recipe }) {
  const t = useTranslations("cook");

  const steps = useMemo(() => cookableSteps(recipe), [recipe]);
  const [index, setIndex] = useState(0);
  const [servings, setServings] = useState(recipe.servings);
  const [ticked, setTicked] = useState<number[]>([]);
  const [sheet, setSheet] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const last = index === steps.length - 1;

  const go = useCallback(
    (delta: -1 | 1) => {
      setIndex((current) =>
        Math.min(steps.length - 1, Math.max(0, current + delta)),
      );
    },
    [steps.length],
  );

  const closeSheet = useCallback(() => {
    setSheet(false);
    opener.current?.focus();
  }, []);

  /**
   * Keyboard, for cooking from a laptop on the counter. Space is left to
   * whatever control has focus — it is that control's own activation key, and
   * stealing it would advance twice.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (sheet) {
        if (event.key === "Escape") closeSheet();
        return;
      }
      if (target?.closest("input, textarea, select") || target?.isContentEditable) {
        return;
      }
      if (event.key === " " && target?.closest("button, a")) return;

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSheet, go, sheet]);

  const recipeHref = {
    pathname: "/app/recipes/[id]" as const,
    params: { id: String(recipe.id) },
  };

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-2 px-2 py-2 sm:px-4">
        <Link
          href={recipeHref}
          aria-label={t("exit")}
          className="grid size-14 shrink-0 place-items-center rounded-full text-[18px] text-text-dim transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
        >
          ✕
        </Link>

        <h1 className="min-w-0 flex-1 truncate font-display text-[16px] leading-[1.2] font-extrabold text-text sm:text-[18px]">
          {recipe.title?.trim() || t("untitled")}
        </h1>

        <span
          data-testid="cook-progress"
          className="tnum shrink-0 font-mono text-[13px] font-semibold text-text-dim"
        >
          {t("progress", { number: index + 1, total: steps.length })}
        </span>
      </header>

      {/* Progress is mint: lime stays on the single action of the view. */}
      <div aria-hidden className="h-1 w-full shrink-0 bg-bg-raised-2">
        <div
          data-testid="cook-progress-bar"
          className="h-full rounded-r-full bg-mint transition-[width] duration-[var(--dur)] ease-[var(--ease)]"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:p-6">
        {/* The step is the only thing on screen, and it scrolls inside its own
            box: a 600-character imported step must not push the controls off
            the bottom of the phone. */}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <p className="shrink-0 text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t("stepLabel", { number: index + 1 })}
          </p>
          <p
            data-testid="cook-step"
            aria-live="polite"
            className="max-w-[34ch] text-[22px] leading-[1.45] font-medium text-text sm:text-[26px] lg:text-[30px] lg:leading-[1.4]"
          >
            {steps[index]}
          </p>
        </main>

        <CookingIngredients
          ingredients={recipe.ingredients}
          recipeServings={recipe.servings}
          servings={servings}
          onServings={setServings}
          ticked={ticked}
          onToggle={(id) =>
            setTicked((current) =>
              current.includes(id)
                ? current.filter((x) => x !== id)
                : [...current, id],
            )
          }
          open={sheet}
          onClose={closeSheet}
        />
      </div>

      {/* A scrim, so a tap anywhere outside the sheet closes it — no precise
          gesture, and nothing behind it is reachable by accident. */}
      {sheet && (
        <button
          type="button"
          aria-label={t("ingredients.close")}
          onClick={closeSheet}
          className="fixed inset-0 z-30 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] lg:hidden"
        />
      )}

      <footer className="flex shrink-0 items-center gap-2 border-t border-line p-3 sm:gap-3 sm:px-4">
        <div className="lg:hidden">
          <button
            ref={opener}
            type="button"
            onClick={() => setSheet(true)}
            className={buttonClasses({
              variant: "secondary",
              className: "h-14 px-5",
            })}
          >
            {t("ingredients.open")}
          </button>
        </div>

        <IconButton
          aria-label={t("previous")}
          variant="secondary"
          className="size-14 text-[18px]"
          disabled={index === 0}
          onClick={() => go(-1)}
        >
          ←
        </IconButton>

        {last ? (
          <Link
            href={recipeHref}
            className={cn(
              buttonClasses({ variant: "primary", className: "h-14 flex-1" }),
            )}
          >
            {t("finish")}
          </Link>
        ) : (
          <Button className="h-14 flex-1" onClick={() => go(1)}>
            {t("next")} →
          </Button>
        )}
      </footer>
    </div>
  );
}
