"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconButton } from "@ui/button";
import { Stepper } from "@ui/stepper";
import { cn } from "@ui/cn";
import type { Recipe } from "@app/lib/api";
import { Icon } from "@ui/icons";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  formatQuantity,
  scaleQuantity,
} from "@app/lib/cooking";

type Props = {
  ingredients: Recipe["ingredients"];
  /** What the recipe was written for. Never changed from here. */
  recipeServings: number;
  /** What is being cooked tonight. */
  servings: number;
  onServings: (servings: number) => void;
  ticked: number[];
  onToggle: (id: number) => void;
  open: boolean;
  onClose: () => void;
};

/**
 * The ingredient list, one tap from the step.
 *
 * Below `lg` it is a sheet over the step, opened by the control in the footer;
 * from `lg` up there is room for both, so it is simply a column beside the
 * step and the toggle disappears. The two states are pure CSS on one node
 * rather than two renderings of the same list — including `invisible`, which
 * is what takes the closed sheet out of the focus order and the accessibility
 * tree without costing the transition.
 */
export function CookingIngredients({
  ingredients,
  recipeServings,
  servings,
  onServings,
  ticked,
  onToggle,
  open,
  onClose,
}: Props) {
  const t = useTranslations("cook.ingredients");
  const locale = useLocale();
  const panel = useRef<HTMLElement>(null);

  // Opening the sheet moves focus into it, so the next tab lands on an
  // ingredient rather than back at the step behind it.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  const scaled = recipeServings !== servings;

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-label={t("title")}
      data-testid="cook-ingredients"
      // The sheet's state, readable without a stylesheet: below `lg` the
      // classes below are what hide it, and jsdom computes none of them.
      data-open={open}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className={cn(
        "flex flex-col overflow-hidden bg-bg-raised outline-none",
        "transition-[transform,visibility] duration-[var(--dur-sheet)] ease-[var(--ease)]",
        // Phone: a sheet rising over the step.
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-h-[75dvh]",
        "max-lg:rounded-t-lg max-lg:border-t max-lg:border-line max-lg:shadow-e3",
        open
          ? "max-lg:visible max-lg:translate-y-0"
          : "max-lg:invisible max-lg:translate-y-full",
        // Desktop: a column of its own, always there.
        "lg:visible lg:translate-y-0 lg:rounded-lg lg:border lg:border-line",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-display text-[16px] leading-[1.2] font-extrabold text-text">
          {t("title")}
        </h2>
        {/* The close control belongs to the sheet, so it goes with it. */}
        <div className="lg:hidden">
          <IconButton
            aria-label={t("close")}
            variant="text"
            size="xl"
            onClick={onClose}
          >
            <Icon name="close" size={22} />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
        <span className="text-[11px] font-bold tracking-[0.02em] text-text-dim uppercase">
          {t("servings")}
        </span>
        <Stepper
          data-testid="cook-servings"
          value={servings}
          onChange={onServings}
          min={MIN_SERVINGS}
          max={MAX_SERVINGS}
          decreaseLabel={t("fewer")}
          increaseLabel={t("more")}
          size="xl"
        >
          {t("people", { count: servings })}
        </Stepper>

        {/* Said only while it is true, and said in full: the quantities in the
            step text are the author's own words and are not recalculated, so a
            scaled session that stayed silent would let the two disagree. */}
        {scaled && (
          <p
            data-testid="cook-scaled-notice"
            className="text-[13px] leading-[1.5] font-medium text-text-dim"
          >
            {t("recipeIsFor", { count: recipeServings })} · {t("stepTextUnchanged")}
          </p>
        )}
      </div>

      {ingredients.length === 0 ? (
        <p className="px-4 py-6 text-[15px] font-medium text-text-dim">{t("empty")}</p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {ingredients.map((ingredient) => {
            const on = ticked.includes(ingredient.id);
            return (
              <li key={ingredient.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(ingredient.id)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left",
                    "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                    on ? "bg-bg-raised-2" : "hover:bg-bg-raised-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-sm border-[1.5px] text-[13px] font-bold",
                      on
                        ? "border-mint bg-mint text-on-accent"
                        : "border-gray text-transparent",
                    )}
                  >
                    ✓
                  </span>

                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "min-w-0 text-[15px] font-medium",
                        on ? "text-text-dim line-through" : "text-text",
                      )}
                    >
                      {ingredient.name}
                    </span>
                    {/* An unverified quantity must never read as a measured
                        one — the same promise the editor makes. */}
                    {ingredient.needsReview && (
                      <span
                        data-testid="cook-ingredient-review"
                        title={t("unverifiedHint")}
                        className="shrink-0 rounded-full border border-coral-ink px-2 py-0.5 text-[11px] font-bold tracking-[0.02em] text-coral-ink uppercase"
                      >
                        {t("unverified")}
                      </span>
                    )}
                  </span>

                  <span className="tnum shrink-0 font-mono text-[14px] text-text-dim">
                    {formatQuantity(
                      scaleQuantity(ingredient.quantity, recipeServings, servings),
                      locale,
                    )}{" "}
                    {ingredient.unit}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
