import { useTranslations } from "next-intl";
import { Badge } from "@ui/badge";
import type { Nutrition } from "@app/[locale]/(app)/app/recipes/actions";

/**
 * Energy and macros per serving, recomputed on every ingredient change rather
 * than behind a "calculate" button.
 *
 * Every figure is tabular so a value changing does not shift the column, and
 * an estimate is marked wherever it appears — a guessed number is never shown
 * as if it had been measured.
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
    <div
      data-testid="nutrition-panel"
      className="rounded-md border border-line bg-bg-raised-2 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("perServing")}
        </span>
        {nutrition.containsEstimates && (
          <Badge tone="coral" data-testid="nutrition-estimated">
            {t("estimated")}
          </Badge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.key} className="flex flex-col gap-1">
            <dt className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
              {t(`labels.${figure.key}`)}
            </dt>
            <dd className="tnum font-mono text-[20px] font-bold text-text">
              {figure.value}
              {figure.unit && (
                <span className="ml-0.5 text-[13px] text-text-dim">
                  {figure.unit}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {nutrition.containsEstimates && (
        <p className="mt-4 text-[12px] font-medium text-text-dim">
          {t("estimatedHint", {
            names: nutrition.ingredients
              .filter((i) => i.guessed)
              .map((i) => i.name)
              .join(", "),
          })}
        </p>
      )}
    </div>
  );
}
