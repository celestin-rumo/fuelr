"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, IconButton } from "@ui/button";
import { Card } from "@ui/card";
import { Chip } from "@ui/chip";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";
import type { Recipe } from "@app/lib/api";
import type { RecipeDraft } from "@app/[locale]/(app)/app/recipes/actions";
import { publishRecipe, saveRecipe } from "@app/[locale]/(app)/app/recipes/actions";

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
  const [published, setPublished] = useState(recipe.status === "PUBLISHED");
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  // New-ingredient row
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>(UNITS[0]);
  const nameRef = useRef<HTMLInputElement>(null);

  const firstRender = useRef(true);

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

  const update = useCallback(
    (patch: Partial<RecipeDraft>) => {
      setDraft((current) => ({ ...current, ...patch }));
      setPublished(false);
      setErrors([]);
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

  async function onPublish() {
    setPublishing(true);
    const result = await publishRecipe(recipe.id, draft);
    setPublishing(false);
    if (result.ok) {
      setPublished(true);
      setErrors([]);
      return;
    }
    setErrors(result.errors);
    // Send the author to the tab that blocks them rather than to a generic error.
    const field = result.errors[0]?.field;
    if (field === "title") setTab(0);
    else if (field === "ingredients") setTab(1);
    else if (field === "steps") setTab(2);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {draft.title.trim() || t("untitled")}
          </h1>
          <p
            data-testid="draft-status"
            className="mt-1 font-mono text-[12px] text-gray"
          >
            {published
              ? t("status.published", {
                  ingredients: draft.ingredients.length,
                  steps: draft.steps.length,
                })
              : saving
                ? t("status.saving")
                : savedAt
                  ? t("status.saved")
                  : t("status.draft", { step: tab + 1 })}
          </p>
        </div>
        <Button onClick={onPublish} loading={publishing}>
          {published ? t("publishedAction") : t("publish")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-current={tab === index ? "step" : undefined}
            onClick={() => setTab(index as Tab)}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[13px] font-semibold",
              "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
              tab === index
                ? "border-accent-ink bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-text"
                : "border-line text-text-dim hover:border-gray hover:text-text",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-5 place-items-center rounded-full font-mono text-[10px] font-bold",
                item.ok ? "bg-accent text-on-accent" : "bg-bg-raised-2 text-gray",
              )}
            >
              {item.ok ? "✓" : index + 1}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      {errors.length > 0 && (
        <p
          role="alert"
          data-testid="recipe-error"
          className="text-[13px] font-semibold text-coral-ink"
        >
          <span aria-hidden>! </span>
          {t(`errors.${errors[0].message}`)}
        </p>
      )}

      <Card as="panel">
        {tab === 0 && (
          <div className="flex flex-col gap-6">
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
              <div className="w-28">
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
              <div className="flex flex-col gap-2">
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
              <ul className="flex flex-col divide-y divide-line">
                {draft.ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.name}-${index}`}
                    className="flex items-center gap-4 py-3"
                  >
                    <span className="flex-1 text-[15px] font-medium text-text">
                      {ingredient.name}
                    </span>
                    <span className="tnum font-mono text-[13px] text-text-dim">
                      {ingredient.quantity} {ingredient.unit}
                    </span>
                    <IconButton
                      aria-label={t("ingredients.remove", {
                        name: ingredient.name,
                      })}
                      variant="text"
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="flex flex-col gap-5">
            <p className="font-mono text-[11px] text-gray">{t("steps.hint")}</p>

            {draft.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-3 font-mono text-[12px] text-gray"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <textarea
                  aria-label={t("steps.label", { number: index + 1 })}
                  rows={2}
                  value={step}
                  onChange={(e) =>
                    update({
                      steps: draft.steps.map((s, i) =>
                        i === index ? e.target.value : s,
                      ),
                    })
                  }
                  className={cn(
                    "flex-1 rounded-sm border-[1.5px] bg-bg px-4 py-3 text-[15px] text-text",
                    "focus:border-mint-ink focus:outline-2 focus:outline-offset-2 focus:outline-[var(--mint-ink)]",
                    step.trim() ? "border-gray" : "border-coral-ink",
                  )}
                />
                <div className="mt-1 flex flex-col gap-1">
                  <IconButton
                    aria-label={t("steps.moveUp", { number: index + 1 })}
                    variant="text"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    aria-label={t("steps.moveDown", { number: index + 1 })}
                    variant="text"
                    disabled={index === draft.steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    aria-label={t("steps.remove", { number: index + 1 })}
                    variant="text"
                    onClick={() =>
                      update({ steps: draft.steps.filter((_, i) => i !== index) })
                    }
                  >
                    ✕
                  </IconButton>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              className="self-start"
              onClick={() => update({ steps: [...draft.steps, ""] })}
            >
              {t("steps.add")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
