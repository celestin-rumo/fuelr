"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { Dialog } from "@ui/dialog";
import { Segmented } from "@ui/segmented";
import { SectionHead } from "@ui/section-head";
import type { RecipeSummary } from "@app/lib/api";
import { SLOTS, formatDay, mondayOf, weekDays } from "@app/lib/week";
import type { Slot } from "@app/lib/week";
import { planMeal } from "@app/[locale]/(app)/app/plan/actions";

/**
 * Put this recipe on a day.
 *
 * The whole point is that it takes one press from the library: opening the
 * planner, finding the week, finding the day, then dragging a card is four
 * decisions for something somebody already decided when they picked the
 * recipe. Here there are two, and both are pre-answered — today, and dinner.
 *
 * It plans into the week *today* falls in. A recipe chosen on Tuesday is
 * almost never for a week that has not started; the planner is where a
 * different week is chosen, and the banner afterwards links straight to it.
 *
 * Nothing is copied: `planned_meals` holds a `recipe_id`, because a meal is an
 * intention for a day that has not happened and a recipe corrected on Tuesday
 * should be the one cooked on Thursday. The servings default to the household
 * size, which is why they are not asked for here.
 */
export function PlanDialog({
  recipe,
  today,
  onClose,
  onPlanned,
}: {
  recipe: RecipeSummary;
  /** Resolved on the server: which day *today* is cannot be asked of the browser. */
  today: string;
  onClose: () => void;
  onPlanned: (message: string) => void;
}) {
  const t = useTranslations("app.plan");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const days = weekDays(mondayOf(today));
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot>("DINNER");

  const title = recipe.title?.trim() || t("untitled");

  function confirm() {
    setError(false);
    startTransition(async () => {
      const result = await planMeal({ date, slot, recipeId: recipe.id });
      if (!result.ok) {
        setError(true);
        return;
      }
      onPlanned(
        t("done", {
          title,
          day: formatDay(date, locale, { weekday: "long", day: "numeric" }),
          slot: t(`slots.${slot}`),
        }),
      );
    });
  }

  return (
    <Dialog
      title={t("title", { title })}
      closeLabel={t("close")}
      onClose={onClose}
      data-testid="plan-dialog"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <SectionHead as="h3">{t("day")}</SectionHead>
          {/* Vertical: seven weekday names do not sit side by side at 360px,
              and a day is the one thing here somebody actually chooses. */}
          <Segmented
            label={t("day")}
            orientation="vertical"
            value={date}
            onChange={setDate}
            data-testid="plan-days"
            options={days.map((day) => ({
              value: day,
              label:
                day === today
                  ? t("todayIs", {
                      day: formatDay(day, locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      }),
                    })
                  : formatDay(day, locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    }),
            }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <SectionHead as="h3">{t("slot")}</SectionHead>
          <Segmented
            label={t("slot")}
            value={slot}
            onChange={setSlot}
            data-testid="plan-slots"
            className="flex-wrap"
            options={SLOTS.map((one) => ({
              value: one,
              label: t(`slots.${one}`),
            }))}
          />
        </div>

        {error && (
          <p role="alert" data-testid="plan-error" className="text-[13px] font-semibold text-coral-ink">
            {t("failed")}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button loading={pending} onClick={confirm} data-testid="plan-confirm">
            {t("confirm")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
