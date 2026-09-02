"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, IconButton } from "@ui/button";
import { Chip } from "@ui/chip";
import { cn } from "@ui/cn";
import type { PlannedMeal, RecipeSummary, WeekPlan } from "@app/lib/api";
import { SLOTS, addDays, formatDay, weekDays } from "@app/lib/week";
import type { Slot } from "@app/lib/week";
import {
  copyWeek,
  planMeal,
  removePlannedMeal,
  setHouseholdSize,
  updatePlannedMeal,
} from "@app/[locale]/(app)/app/plan/actions";

/**
 * What is currently being dragged.
 *
 * It is kept in React state rather than read from the DragEvent, because
 * `dataTransfer.getData` is deliberately blocked during `dragover` — the only
 * moment a slot needs to know whether the thing over it is droppable.
 */
type Drag =
  | { kind: "recipe"; recipeId: number }
  | { kind: "meal"; mealId: number };

export function WeekPlanner({
  plan,
  recipes,
  today,
}: {
  plan: WeekPlan;
  recipes: RecipeSummary[];
  /** Resolved on the server: the browser's idea of "today" may be a day off. */
  today: string;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ date: string; slot: Slot } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);

  // The stepper moves on click and stays moved while the request is in flight.
  // The server value is the truth; this only spares the count a round trip.
  const [household, setOptimisticHousehold] = useOptimistic(
    plan.householdSize,
    (_current: number, size: number) => size,
  );

  const days = weekDays(plan.weekStart);
  const nextWeek = addDays(plan.weekStart, 7);
  const editingMeal = plan.meals.find((meal) => meal.id === editing) ?? null;

  const untitled = t("untitled");
  const nameOf = (meal: PlannedMeal) => meal.title?.trim() || untitled;
  const dayName = (date: string) => formatDay(date, locale, { weekday: "long" });
  const slotName = (slot: Slot) => t(`slots.${slot}`);

  function run(action: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
    });
  }

  function drop(date: string, slot: Slot) {
    setOver(null);
    const dragged = drag;
    setDrag(null);
    if (!dragged) return;
    if (dragged.kind === "recipe") {
      run(() => planMeal({ date, slot, recipeId: dragged.recipeId }));
    } else {
      run(() => updatePlannedMeal(dragged.mealId, { date, slot }));
    }
  }

  function duplicate(replace = false) {
    startTransition(async () => {
      const result = await copyWeek(plan.weekStart, nextWeek, replace);
      if (result.ok) {
        setReplacing(false);
        // Land on the week that was just filled in: a copy nobody is shown is
        // indistinguishable from a button that did nothing.
        router.push({ pathname: "/app/plan", query: { week: nextWeek } });
        return;
      }
      // Not a failure: the next week is already planned, and overwriting it is
      // the cook's call to make, not ours.
      if (result.conflict) setReplacing(true);
    });
  }

  function changeHousehold(size: number) {
    if (size < 1 || size > 12) return;
    startTransition(async () => {
      setOptimisticHousehold(size);
      const result = await setHouseholdSize(size);
      // useOptimistic drops its value the moment the transition settles, so
      // without refetching the count springs back to what was rendered.
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-[0.85]")}>
      <Toolbar
        weekStart={plan.weekStart}
        today={today}
        locale={locale}
        household={household}
        onHousehold={changeHousehold}
        onDuplicate={() => duplicate(false)}
      />

      <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
        {/* Dragging needs a pointer, and the grid needs the width below xl, so
            the rail is a wide-screen affordance. Everywhere else the same
            recipes are one tap away inside each slot. */}
        <div className="hidden xl:block">
          <RecipeRail recipes={recipes} onDragStart={setDrag} onDragEnd={() => setDrag(null)} />
        </div>

        {/*
          Days are rows and meals are columns from `lg` up.
          Seven columns of four would give each slot about 150px on a laptop,
          which is not enough for a recipe title; four columns of seven give it
          250px. Every cell lives in this one grid — the day sections dissolve
          into it with `display: contents` — so Wednesday's dinner lines up with
          Thursday's by construction rather than by matching heights. Cells
          stretch to the tallest in their row, so a day with one long dish does
          not leave three ragged boxes beside it.
        */}
        <div
          className="grid gap-3 lg:grid-cols-[6.5rem_repeat(4,minmax(0,1fr))]"
          data-testid="week-grid"
        >
          {/* The column headers the narrow layout does not have: there, every
              cell carries its own label instead. */}
          <div className="hidden lg:contents" aria-hidden>
            <span />
            {SLOTS.map((slot) => (
              <span
                key={slot}
                className="px-1 text-[11px] font-bold tracking-[0.02em] text-gray uppercase"
              >
                {slotName(slot)}
              </span>
            ))}
          </div>

          {days.map((date) => {
            const totals = plan.days.find((day) => day.date === date);
            return (
              <section
                key={date}
                data-testid={`day-${date}`}
                className={cn(
                  "flex flex-col gap-2 rounded-md border bg-bg-raised p-3 lg:contents",
                  date === today ? "border-accent-ink" : "border-line",
                )}
              >
                <header
                  className={cn(
                    "flex items-baseline justify-between gap-2 border-b border-line pb-2",
                    "lg:flex-col lg:justify-start lg:border-b-0 lg:pb-0 lg:pt-2",
                    date === today && "lg:border-l-2 lg:border-l-[var(--lime-ink)] lg:pl-2",
                  )}
                >
                  <h2 className="font-display text-[15px] font-bold text-text">
                    <span className="capitalize">
                      {formatDay(date, locale, { weekday: "short" })}
                    </span>{" "}
                    <span className="tnum font-mono text-[13px] font-normal text-gray">
                      {formatDay(date, locale, { day: "numeric", month: "numeric" })}
                    </span>
                  </h2>
                  {/* No figure rather than a zero: nothing planned costs
                      nothing, and saying "0 kcal" would read as a diet. */}
                  {totals?.kcal != null && (
                    <span className="tnum font-mono text-[11px] text-gray">
                      {t("dayKcal", { kcal: totals.kcal })}
                    </span>
                  )}
                </header>

                {SLOTS.map((slot) => {
                  const key = `${date}:${slot}`;
                  const meals = plan.meals
                    .filter((meal) => meal.date === date && meal.slot === slot)
                    .sort((a, b) => a.position - b.position);
                  return (
                    <div
                      key={slot}
                      data-testid={`slot-${date}-${slot}`}
                      onDragOver={(event) => {
                        if (!drag) return;
                        // Without this the browser refuses the drop and plays
                        // the "snap back" animation instead.
                        event.preventDefault();
                        setOver(key);
                      }}
                      onDragLeave={() => setOver((current) => (current === key ? null : current))}
                      onDrop={(event) => {
                        event.preventDefault();
                        drop(date, slot);
                      }}
                      className={cn(
                        "flex min-w-0 flex-col gap-2 rounded-sm border border-dashed p-2",
                        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                        over === key
                          ? "border-accent-ink bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                          : "border-line",
                      )}
                    >
                      {/* Named per cell only where there is no column header. */}
                      <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase lg:hidden">
                        {slotName(slot)}
                      </span>

                      {meals.map((meal) => (
                        <article
                          key={meal.id}
                          draggable
                          onDragStart={() => setDrag({ kind: "meal", mealId: meal.id })}
                          onDragEnd={() => setDrag(null)}
                          data-testid={`meal-${meal.id}`}
                          className="min-w-0 rounded-sm border border-line bg-bg-raised-2 p-2"
                        >
                          <button
                            type="button"
                            onClick={() => setEditing(meal.id)}
                            aria-label={t("meal.open", {
                              title: nameOf(meal),
                              day: dayName(date),
                              slot: slotName(slot),
                            })}
                            className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
                          >
                            <span className="block font-display text-[13px] leading-[1.2] font-bold break-words text-text">
                              {nameOf(meal)}
                            </span>
                            <span className="tnum mt-1 block font-mono text-[11px] text-gray">
                              {t("servingsShort", { count: meal.servings })}
                              {meal.kcal != null && ` · ${t("dayKcal", { kcal: meal.kcal })}`}
                            </span>
                          </button>
                        </article>
                      ))}

                      {/* An empty slot is a normal evening, so it says what it
                          is and offers the way out — never an error tone. */}
                      <button
                        type="button"
                        onClick={() => setPicking({ date, slot })}
                        aria-label={t("addTo", { day: dayName(date), slot: slotName(slot) })}
                        className="flex h-8 items-center justify-center rounded-sm text-[13px] font-semibold text-gray hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
                      >
                        {meals.length === 0 ? t("nothingPlanned") : t("add")}
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      {picking && (
        <RecipePicker
          recipes={recipes}
          title={`${dayName(picking.date)} · ${slotName(picking.slot)}`}
          onClose={() => setPicking(null)}
          onPick={(recipeId) => {
            const target = picking;
            setPicking(null);
            run(() => planMeal({ date: target.date, slot: target.slot, recipeId }));
          }}
        />
      )}

      {editingMeal && (
        <MealSheet
          meal={editingMeal}
          weekStart={plan.weekStart}
          locale={locale}
          onClose={() => setEditing(null)}
          onServings={(servings) =>
            run(() => updatePlannedMeal(editingMeal.id, { servings }))
          }
          onMove={(patch) => run(() => updatePlannedMeal(editingMeal.id, patch))}
          onRemove={() => {
            setEditing(null);
            run(() => removePlannedMeal(editingMeal.id));
          }}
        />
      )}

      {replacing && (
        <Dialog title={t("duplicate.title")} onClose={() => setReplacing(false)}>
          <p className="mt-3 text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("duplicate.body")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="danger" onClick={() => duplicate(true)}>
              {t("duplicate.confirm")}
            </Button>
            <Button variant="secondary" onClick={() => setReplacing(false)}>
              {t("duplicate.cancel")}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// --- toolbar ---------------------------------------------------------------

function Toolbar({
  weekStart,
  today,
  locale,
  household,
  onHousehold,
  onDuplicate,
}: {
  weekStart: string;
  today: string;
  locale: string;
  household: number;
  onHousehold: (size: number) => void;
  onDuplicate: () => void;
}) {
  const t = useTranslations("plan");
  const label = t("week", {
    date: formatDay(weekStart, locale, { day: "numeric", month: "long" }),
  });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-2">
        <WeekLink week={addDays(weekStart, -7)} label={t("previousWeek")}>
          ←
        </WeekLink>
        <h2
          data-testid="week-label"
          className="font-display text-[15px] font-bold text-text"
        >
          {label}
        </h2>
        <WeekLink week={addDays(weekStart, 7)} label={t("nextWeek")}>
          →
        </WeekLink>
      </div>

      <Link
        href={{ pathname: "/app/plan", query: { week: today } }}
        className="text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
      >
        {t("thisWeek")}
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("household.label")}
        </span>
        <IconButton
          aria-label={t("household.less")}
          variant="tertiary"
          onClick={() => onHousehold(household - 1)}
          disabled={household <= 1}
        >
          −
        </IconButton>
        <span
          data-testid="household-size"
          className="tnum min-w-8 text-center font-mono text-[15px] font-bold text-text"
        >
          {household}
        </span>
        <IconButton
          aria-label={t("household.more")}
          variant="tertiary"
          onClick={() => onHousehold(household + 1)}
          disabled={household >= 12}
        >
          +
        </IconButton>
      </div>

      <Button variant="secondary" onClick={onDuplicate}>
        {t("duplicate.action")}
      </Button>
    </div>
  );
}

/**
 * An anchor that looks like a control. A Button inside a Link would be two
 * interactive elements where the markup promises one.
 */
function WeekLink({
  week,
  label,
  children,
}: {
  week: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={{ pathname: "/app/plan", query: { week } }}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-line text-text-dim hover:border-gray hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
    >
      {children}
    </Link>
  );
}

// --- the recipe rail -------------------------------------------------------

function RecipeRail({
  recipes,
  onDragStart,
  onDragEnd,
}: {
  recipes: RecipeSummary[];
  onDragStart: (drag: Drag) => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations("plan");
  const [term, setTerm] = useState("");
  const untitled = t("untitled");
  const shown = recipes.filter((recipe) =>
    (recipe.title ?? untitled).toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-bg-raised p-4">
      <h2 className="font-display text-[15px] font-bold text-text">{t("rail.title")}</h2>
      <p className="text-[13px] font-semibold text-text-dim">{t("rail.hint")}</p>

      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        aria-label={t("rail.search")}
        placeholder={t("rail.search")}
        className="h-9 rounded-sm border border-line bg-bg-raised-2 px-3 text-[13px] font-semibold text-text placeholder:text-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
      />

      {shown.length === 0 ? (
        <p className="text-[13px] font-semibold text-text-dim">{t("rail.noResults")}</p>
      ) : (
        <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
          {shown.map((recipe) => (
            <li key={recipe.id}>
              <div
                draggable
                onDragStart={() => onDragStart({ kind: "recipe", recipeId: recipe.id })}
                onDragEnd={onDragEnd}
                data-testid={`rail-recipe-${recipe.id}`}
                className="cursor-grab rounded-sm border border-line bg-bg-raised-2 p-2 active:cursor-grabbing"
              >
                <span className="block font-display text-[13px] leading-[1.2] font-bold text-text">
                  {recipe.title?.trim() || untitled}
                </span>
                <span className="tnum mt-1 block font-mono text-[11px] text-gray">
                  {t("recipeMeta", { servings: recipe.servings, minutes: recipe.minutes })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- dialogs ---------------------------------------------------------------

function RecipePicker({
  recipes,
  title,
  onPick,
  onClose,
}: {
  recipes: RecipeSummary[];
  title: string;
  onPick: (recipeId: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const [term, setTerm] = useState("");
  const untitled = t("untitled");
  const shown = recipes.filter((recipe) =>
    (recipe.title ?? untitled).toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <Dialog title={title} onClose={onClose}>
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        aria-label={t("rail.search")}
        placeholder={t("rail.search")}
        className="mt-4 h-11 w-full rounded-sm border border-line bg-bg-raised-2 px-3 text-[15px] font-semibold text-text placeholder:text-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
      />
      {shown.length === 0 ? (
        <p className="mt-4 text-[15px] font-medium text-text-dim">{t("rail.noResults")}</p>
      ) : (
        <ul className="mt-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {shown.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                onClick={() => onPick(recipe.id)}
                className="flex w-full flex-col items-start rounded-sm border border-line bg-bg-raised-2 p-3 text-left hover:border-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
              >
                <span className="font-display text-[15px] font-bold text-text">
                  {recipe.title?.trim() || untitled}
                </span>
                <span className="tnum mt-1 font-mono text-[13px] text-gray">
                  {t("recipeMeta", { servings: recipe.servings, minutes: recipe.minutes })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function MealSheet({
  meal,
  weekStart,
  locale,
  onServings,
  onMove,
  onRemove,
  onClose,
}: {
  meal: PlannedMeal;
  weekStart: string;
  locale: string;
  onServings: (servings: number) => void;
  onMove: (patch: { date?: string; slot?: Slot }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const title = meal.title?.trim() || t("untitled");

  return (
    <Dialog title={title} onClose={onClose}>
      <p className="tnum mt-2 font-mono text-[13px] text-gray">
        {t("meal.scaled", { count: meal.recipeServings, minutes: meal.minutes })}
        {meal.estimated && <span className="ml-2 text-coral-ink">{t("estimated")}</span>}
      </p>

      <section className="mt-6">
        <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("meal.servings")}
        </h3>
        <div className="mt-2 flex items-center gap-3">
          <IconButton
            aria-label={t("meal.less", { title })}
            variant="tertiary"
            size="xl"
            disabled={meal.servings <= 1}
            onClick={() => onServings(meal.servings - 1)}
          >
            −
          </IconButton>
          <span
            data-testid="meal-servings"
            className="tnum min-w-10 text-center font-mono text-[22px] font-bold text-text"
          >
            {meal.servings}
          </span>
          <IconButton
            aria-label={t("meal.more", { title })}
            variant="tertiary"
            size="xl"
            disabled={meal.servings >= 24}
            onClick={() => onServings(meal.servings + 1)}
          >
            +
          </IconButton>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("meal.moveTitle")}
        </h3>
        {/* Chips rather than a drag: this is the path that works from a
            keyboard, and on a phone where nothing can be dragged. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {weekDays(weekStart).map((date) => (
            <Chip
              key={date}
              active={date === meal.date}
              onClick={() => onMove({ date })}
            >
              <span className="capitalize">
                {formatDay(date, locale, { weekday: "short" })}
              </span>
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {SLOTS.map((slot) => (
            <Chip key={slot} active={slot === meal.slot} onClick={() => onMove({ slot })}>
              {t(`slots.${slot}`)}
            </Chip>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={{ pathname: "/app/recipes/[id]", params: { id: String(meal.recipeId) } }}
          className="text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
        >
          {t("meal.openRecipe")}
        </Link>
        <div className="flex-1" />
        <Button variant="danger" onClick={onRemove}>
          {t("meal.remove")}
        </Button>
      </div>
    </Dialog>
  );
}

/** Modal shell: one place decides how a dialog closes. */
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations("plan");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,0.6)] p-6"
    >
      <div className="w-full max-w-lg rounded-lg border border-line bg-bg-raised p-6 shadow-e3 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
            {title}
          </h2>
          {/* Focus lands here on open, so the dialog is where the keyboard
              is and Escape is one key away from the first tab stop. */}
          <IconButton autoFocus aria-label={t("close")} variant="text" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
