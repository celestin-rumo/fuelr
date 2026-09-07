"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Checkbox } from "@ui/checkbox";
import { Card } from "@ui/card";
import { cn } from "@ui/cn";
import { formatDay } from "@app/lib/week";
import type { PlannedMeal } from "@app/lib/api";
import { updatePlannedMeal } from "@app/[locale]/(app)/app/plan/actions";

/**
 * What this list is buying for, and the way to take a meal out of it.
 *
 * A week is planned before it is shopped for, and by then some of it is
 * already in the cupboard: Thursday's soup was made from what is in the
 * freezer, Saturday is somebody else's turn. Saying so takes one tick and
 * removes exactly that meal's ingredients — the meal stays on the plan, keeps
 * its figures, and is still something to cook.
 *
 * Folded by default. The list is the page; this is what stands behind it.
 */
export function ShoppingMeals({ meals }: { meals: PlannedMeal[] }) {
  const t = useTranslations("shopping.meals");
  const locale = useLocale();
  const tSlots = useTranslations("plan.slots");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (meals.length === 0) return null;

  const excluded = meals.filter((meal) => !meal.inShopping).length;

  function toggle(meal: PlannedMeal, inShopping: boolean) {
    startTransition(async () => {
      const result = await updatePlannedMeal(meal.id, { inShopping });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card as="panel" className={cn(pending && "opacity-[0.85]")}>
      <details data-testid="shopping-meals">
        {/* A control with a box of its own, so it carries the 44px floor a
            phone needs — `e2e/mobile-360.spec.ts` measures it. */}
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0">
          <span className="font-display text-[16px] font-bold text-text">
            {t("title", { count: meals.length })}
          </span>
          {/* Only ever said when it is true: a list nobody has narrowed has
              nothing to explain. */}
          {excluded > 0 && (
            <span
              data-testid="excluded-count"
              className="text-[13px] font-semibold text-mint-ink"
            >
              {t("excluded", { count: excluded })}
            </span>
          )}
        </summary>

        <p className="mt-2 text-[13px] font-semibold text-text-dim">{t("hint")}</p>

        <ul className="mt-3 flex flex-col gap-1">
          {meals.map((meal) => (
            <li key={meal.id}>
              <Checkbox
                className="min-h-11"
                data-testid={`meal-in-shopping-${meal.id}`}
                checked={!meal.inShopping}
                onChange={(event) => toggle(meal, !event.target.checked)}
                label={t("row", {
                  day: formatDay(meal.date, locale, { weekday: "long" }),
                  slot: tSlots(meal.slot),
                  title: meal.title ?? t("untitled"),
                })}
              />
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
