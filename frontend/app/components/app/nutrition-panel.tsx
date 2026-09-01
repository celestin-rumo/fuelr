import { useTranslations } from "next-intl";
import { cn } from "@ui/cn";
import type { Nutrition } from "@app/[locale]/(app)/app/recipes/actions";

/**
 * A read-only summary of the ingredients above, recomputed on every change.
 *
 * Deliberately quiet: it is a consequence of the list, not a field to fill in.
 * An earlier version led the tab with large figures and read as the first
 * thing to edit.
 */
export function NutritionPanel({ nutrition }: { nutrition: Nutrition | null }) {
  const t = useTranslations("recipe.nutrition");

  if (!nutrition) {
    return (
      <p className="text-[13px] font-medium text-text-dim">{t("empty")}</p>
    );
  }

  const figures = [
    { key: "kcal", value: nutrition.perServing.kcal, unit: "" },
    { key: "protein", value: nutrition.perServing.proteinG, unit: "g" },
    { key: "carbs", value: nutrition.perServing.carbsG, unit: "g" },
    { key: "fat", value: nutrition.perServing.fatG, unit: "g" },
  ] as const;

  return (
    <section
      data-testid="nutrition-panel"
      aria-label={t("title")}
      className="flex flex-col gap-2 border-t border-line pt-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("title")}
        </h3>
        <span className="text-[12px] font-medium text-gray">
          {t("automatic")}
        </span>
      </div>

      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {figures.map((figure) => (
          <div key={figure.key} className="flex items-baseline gap-1.5">
            <dt className="text-[12px] font-semibold text-text-dim">
              {t(`labels.${figure.key}`)}
            </dt>
            <dd
              className={cn(
                "tnum font-mono text-[15px] font-bold",
                nutrition.containsEstimates ? "text-text-dim" : "text-text",
              )}
            >
              {figure.value}
              {figure.unit}
            </dd>
          </div>
        ))}
      </dl>

      {nutrition.containsEstimates && (
        <p
          data-testid="nutrition-estimated"
          className="text-[12px] font-medium text-coral-ink"
        >
          {t("estimatedHint", {
            names: nutrition.ingredients
              .filter((i) => i.guessed)
              .map((i) => i.name)
              .join(", "),
          })}
        </p>
      )}
    </section>
  );
}
