"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, IconButton } from "@ui/button";
import { Card } from "@ui/card";
import { Chip } from "@ui/chip";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";
import type { Recipe } from "@app/lib/api";
import type { RecipeDraft } from "@app/[locale]/(app)/app/recipes/actions";
import {
  computeNutrition,
  saveRecipe,
} from "@app/[locale]/(app)/app/recipes/actions";
import type { Nutrition } from "@app/[locale]/(app)/app/recipes/actions";
import { NutritionPanel } from "./nutrition-panel";
import { RecipePhoto } from "./recipe-photo";

const UNITS = ["g", "ml", "pcs", "c.à.s", "c.à.c"] as const;
const LEVELS = ["easy", "medium", "hard"] as const;
const TAGS = [
  "vegetarian",
  "quick",
  "batch",
  "protein",
  "glutenFree",
  "cheap",
] as const;

const AUTOSAVE_DELAY = 800;

type Tab = 0 | 1 | 2;

function toDraft(recipe: Recipe): RecipeDraft {
  return {
    title: recipe.title ?? "",
    description: recipe.description ?? "",
    servings: recipe.servings,
    level: recipe.level,
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
    steps: recipe.steps,
    tags: recipe.tags,
  };
}

export function RecipeEditor({ recipe }: { recipe: Recipe }) {
  const t = useTranslations("recipe");

  const [draft, setDraft] = useState<RecipeDraft>(() => toDraft(recipe));
  const [tab, setTab] = useState<Tab>(0);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [nutrition, setNutrition] = useState<Nutrition | null>(null);

  // New-ingredient row
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>(UNITS[0]);
  const nameRef = useRef<HTMLInputElement>(null);

  const firstRender = useRef(true);

  // Captured on open, not derived from the current draft: the point is whether
  // the recipe was already usable when the author arrived, not whether it has
  // become complete while they typed.
  const [wasAlreadyUsable] = useState(() => recipe.status === "PUBLISHED");

  /**
   * Autosave. The draft already exists server-side, so every change is an
   * update to a real row — which is what lets the editor leave without ever
   * asking "do you want to save?".
   */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaving(true);
      const result = await saveRecipe(recipe.id, draft);
      setSaving(false);
      if (result.ok) setSavedAt(Date.now());
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [draft, recipe.id]);

  /**
   * Recomputed on every ingredient and serving change — never behind a
   * button. The author adjusts the recipe while writing it, so the figures
   * have to follow without being asked.
   */
  useEffect(() => {
    let cancelled = false;
    computeNutrition(draft.ingredients, draft.servings).then((result) => {
      if (!cancelled) setNutrition(result);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.ingredients, draft.servings]);

  const update = useCallback(
    (patch: Partial<RecipeDraft>) => {
      setDraft((current) => ({ ...current, ...patch }));
    },
    [],
  );

  function addIngredient() {
    const parsed = Number.parseFloat(quantity.replace(",", "."));
    if (!name.trim() || !(parsed > 0)) return;
    update({
      ingredients: [
        ...draft.ingredients,
        { name: name.trim(), quantity: parsed, unit },
      ],
    });
    setName("");
    setQuantity("");
    nameRef.current?.focus();
  }

  /** Moves a step by one position. Buttons rather than drag: they work with a
   *  keyboard, on a touch screen, and with a screen reader. */
  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    update({ steps });
  }

  const complete = {
    base: draft.title.trim().length > 0,
    ingredients: draft.ingredients.length > 0,
    steps: draft.steps.length > 0 && draft.steps.every((s) => s.trim()),
  };

  const tabs = [
    { label: t("tabs.base"), ok: complete.base },
    { label: t("tabs.ingredients"), ok: complete.ingredients },
    { label: t("tabs.steps"), ok: complete.steps },
  ];

  const missing = [
    !complete.base && "title",
    !complete.ingredients && "ingredients",
    !complete.steps && "steps",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-7">
      {/* Close sits before the title and never moves, whatever tab is open. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/app"
            aria-label={t("back")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-text-dim transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:border-gray hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
          >
            {/* An arrow, not a cross: a cross beside a title reads as "delete
                this", and nothing here is destructive. */}
            ←
          </Link>

          <h1 className="min-w-0 truncate font-display text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {draft.title.trim() || t("untitled")}
          </h1>

          {/* Status is information, not a control — so it reads as text beside
              the title rather than as a button that always says "Saved". */}
          <span
            data-testid="draft-status"
            aria-live="polite"
            className={cn(
              "shrink-0 text-[13px] font-medium",
              (savedAt || wasAlreadyUsable) && !saving
                ? "text-mint-ink"
                : "text-gray",
            )}
          >
            {saving
              ? t("status.saving")
              : // A recipe that was already complete on open reads as saved,
                // even before this session has written anything.
                savedAt || wasAlreadyUsable
                ? t("status.saved")
                : t("status.draft")}
          </span>
        </div>

      </div>

      {/* A stepper, not a row of chips: the three parts are a sequence, and
          the connecting rule is what says so. */}
      <ol
        className="flex items-center gap-0"
        aria-label={t("stepperLabel")}
      >
        {tabs.map((item, index) => (
          <li key={item.label} className="flex min-w-0 flex-1 items-center last:flex-none">
            <button
              type="button"
              aria-current={tab === index ? "step" : undefined}
              onClick={() => setTab(index as Tab)}
              className={cn(
                "flex min-w-0 shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 text-left sm:gap-3",
                // On a narrow screen only the current step keeps its label,
                // so three labels cannot squeeze the connectors to nothing.
                tab === index ? "pr-3 sm:pr-4" : "pr-1.5 sm:pr-4",
                "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                tab === index
                  ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
                  : "hover:bg-bg-raised-2",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[12px] font-bold",
                  item.ok
                    ? "border-accent bg-accent text-on-accent"
                    : tab === index
                      ? "border-accent-ink text-accent-ink"
                      : "border-line text-gray",
                )}
              >
                {item.ok ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[14px] font-bold",
                  // Hidden from view on a narrow screen, never from the
                  // accessibility tree: `hidden` would leave these buttons
                  // with no accessible name at all.
                  tab === index
                    ? "text-text"
                    : "sr-only text-text-dim sm:not-sr-only sm:inline",
                )}
              >
                {item.label}
              </span>
            </button>

            {index < tabs.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1.5 h-[2px] min-w-3 flex-1 rounded-full sm:mx-2 sm:min-w-6",
                  item.ok ? "bg-accent" : "bg-line",
                )}
              />
            )}
          </li>
        ))}
      </ol>

      {wasAlreadyUsable && (
        <p
          data-testid="already-used-notice"
          className="rounded-md border border-line bg-bg-raised-2 px-4 py-3 text-[13px] leading-[1.5] font-medium text-text-dim"
        >
          {t("alreadyUsed")}
        </p>
      )}

      {/* The stepper marks what is done; this says what is left, since there
          is no longer a button to press and be refused by. */}
      {missing.length > 0 && (
        <p data-testid="missing-hint" className="text-[13px] font-medium text-text-dim">
          {t("missing", { what: missing.map((m) => t(`missingParts.${m}`)).join(", ") })}
        </p>
      )}

      <Card as="panel">
        {tab === 0 && (
          <div className="flex flex-col gap-6">
            <RecipePhoto recipeId={recipe.id} hasPhoto={recipe.hasPhoto} />

            <Input
              label={t("base.title")}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              hint={t("base.titleHint")}
            />

            <div className="flex flex-col gap-2">
              <label
                htmlFor="recipe-description"
                className="text-[13px] font-semibold text-text-dim"
              >
                {t("base.description")}
              </label>
              <textarea
                id="recipe-description"
                rows={3}
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                className="w-full rounded-sm border-[1.5px] border-gray bg-bg px-4 py-3 text-[15px] text-text focus:border-mint-ink focus:outline-2 focus:outline-offset-2 focus:outline-[var(--mint-ink)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-dim">
                {t("base.servings")}
              </span>
              <div className="flex items-center gap-3">
                <IconButton
                  aria-label={t("base.fewer")}
                  variant="secondary"
                  onClick={() =>
                    update({ servings: Math.max(1, draft.servings - 1) })
                  }
                >
                  −
                </IconButton>
                <span className="tnum min-w-28 text-center text-[15px] font-semibold text-text">
                  {t("base.people", { count: draft.servings })}
                </span>
                <IconButton
                  aria-label={t("base.more")}
                  variant="secondary"
                  onClick={() =>
                    update({ servings: Math.min(12, draft.servings + 1) })
                  }
                >
                  +
                </IconButton>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-dim">
                {t("base.level")}
              </span>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => (
                  <Chip
                    key={level}
                    active={draft.level === level}
                    onClick={() =>
                      update({ level: draft.level === level ? null : level })
                    }
                  >
                    {t(`levels.${level}`)}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-dim">
                {t("base.tags")}
              </span>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => {
                  const on = draft.tags.includes(tag);
                  return (
                    <Chip
                      key={tag}
                      active={on}
                      onClick={() =>
                        update({
                          tags: on
                            ? draft.tags.filter((x) => x !== tag)
                            : [...draft.tags, tag],
                        })
                      }
                    >
                      {t(`tags.${tag}`)}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  ref={nameRef}
                  label={t("ingredients.name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addIngredient();
                    }
                  }}
                />
              </div>

              {/* Quantity and unit share one line on a phone rather than
                  stacking: they are one measurement, and two full-width rows
                  for "300" and "g" pushed the button off the first screen.
                  `sm:contents` lets them rejoin the parent row on wider
                  viewports. */}
              <div className="flex items-end gap-3 sm:contents">
                <div className="flex-1 sm:w-28 sm:flex-none">
                  <Input
                    label={t("ingredients.quantity")}
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addIngredient();
                      }
                    }}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:flex-none">
                  <label
                    htmlFor="ingredient-unit"
                    className="text-[13px] font-semibold text-text-dim"
                  >
                    {t("ingredients.unit")}
                  </label>
                  <select
                    id="ingredient-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    onKeyDown={(e) => {
                      // The unit is the last field of the row, so Enter has to
                      // commit from here too or the keyboard chain dead-ends.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addIngredient();
                      }
                    }}
                    className="h-[46px] rounded-sm border-[1.5px] border-gray bg-bg px-3 text-[15px] text-text focus:border-mint-ink focus:outline-2 focus:outline-offset-2 focus:outline-[var(--mint-ink)]"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button variant="secondary" onClick={addIngredient}>
                {t("ingredients.add")}
              </Button>
            </div>

            <p className="font-mono text-[11px] text-gray">
              {t("ingredients.hint")}
            </p>

            {draft.ingredients.length === 0 ? (
              <p className="text-[15px] font-medium text-text-dim">
                {t("ingredients.empty")}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-md border border-line">
                {draft.ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.name}-${index}`}
                    className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 hover:bg-bg-raised-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                      {ingredient.name}
                    </span>

                    {/* Quantity and its remove control belong to the same
                        ingredient, so they sit together on the right rather
                        than drifting apart across the row. */}
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tnum font-mono text-[13px] text-text-dim">
                        {ingredient.quantity} {ingredient.unit}
                      </span>
                      <IconButton
                        aria-label={t("ingredients.remove", {
                          name: ingredient.name,
                        })}
                        variant="dangerText"
                        className="size-8"
                        onClick={() =>
                          update({
                            ingredients: draft.ingredients.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        ✕
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* After the list, because it summarises it. Placed above, it read
                as the first thing to fill in. */}
            <NutritionPanel nutrition={nutrition} />
          </div>
        )}

        {tab === 2 && (
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[11px] text-gray">{t("steps.hint")}</p>

            {draft.steps.map((step, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-md border-[1.5px] bg-bg transition-[border-color] duration-[var(--dur-fast)] ease-[var(--ease)]",
                  "focus-within:border-mint-ink",
                  step.trim() ? "border-line" : "border-coral-ink",
                )}
              >
                <div className="flex items-start gap-3 px-4 pt-3">
                  <span aria-hidden className="mt-2 font-mono text-[12px] text-gray">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {/* Borderless: the card carries the outline, so the controls
                      below read as part of the same step. */}
                  <textarea
                    aria-label={t("steps.label", { number: index + 1 })}
                    value={step}
                    onChange={(e) =>
                      update({
                        steps: draft.steps.map((s, i) =>
                          i === index ? e.target.value : s,
                        ),
                      })
                    }
                    className="min-h-24 flex-1 resize-y bg-transparent py-2 text-[15px] leading-[1.5] text-text outline-none"
                  />
                </div>

                {/* One line, inside the card: three stacked buttons took more
                    room than the step itself. */}
                <div className="flex items-center justify-end gap-1 border-t border-line px-2 py-1.5">
                  <IconButton
                    aria-label={t("steps.moveUp", { number: index + 1 })}
                    variant="text"
                    className="size-8"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    aria-label={t("steps.moveDown", { number: index + 1 })}
                    variant="text"
                    className="size-8"
                    disabled={index === draft.steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    aria-label={t("steps.remove", { number: index + 1 })}
                    variant="dangerText"
                    className="size-8"
                    onClick={() =>
                      update({ steps: draft.steps.filter((_, i) => i !== index) })
                    }
                  >
                    ✕
                  </IconButton>
                </div>
              </div>
            ))}

            {/* Directly under the last step, where the next one goes. */}
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => update({ steps: [...draft.steps, ""] })}
            >
              {t("steps.add")}
            </Button>
          </div>
        )}

        {/* Moving on is part of the panel, not something to hunt for in the
            stepper above. */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          {tab > 0 ? (
            <Button
              variant="text"
              onClick={() => setTab((tab - 1) as Tab)}
            >
              ← {t("nav.previous")}
            </Button>
          ) : (
            <span />
          )}

          {tab < 2 ? (
            <Button onClick={() => setTab((tab + 1) as Tab)}>
              {t("nav.next")} →
            </Button>
          ) : (
            <Link href="/app">
              <Button>{t("nav.finish")}</Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
