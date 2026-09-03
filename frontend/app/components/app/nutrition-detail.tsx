"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@ui/button";
import type { NutritionDetail } from "@app/lib/api";
import { nutritionDetail } from "@app/[locale]/(app)/app/journal/actions";

/**
 * The paid detail, under the free summary.
 *
 * Energy and the three macros stay free: they are what lets somebody place a
 * dish at a glance, and taking them away would make the free plan worse rather
 * than the paid one better. What is behind the plan is everything past them —
 * fibre, sugars, salt, and the vitamins and minerals the source measured.
 *
 * Fetched only when asked for. It is one request per recipe, and most people
 * looking at an editor are not looking at vitamins.
 */
export function NutritionDetailPanel({
  ingredients,
  servings,
}: {
  ingredients: { name: string; quantity: number; unit: string }[];
  servings: number;
}) {
  const t = useTranslations("recipe.detail");
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<NutritionDetail | null>(null);
  const [locked, setLocked] = useState(false);

  if (ingredients.length === 0) {
    return null;
  }

  function open() {
    startTransition(async () => {
      const result = await nutritionDetail(ingredients, Math.max(1, servings));
      if (result.ok) {
        setDetail(result.detail);
        setLocked(false);
        return;
      }
      setLocked(result.reason === "upgrade_required");
    });
  }

  if (locked) {
    return (
      <div data-testid="detail-locked" className="border-t border-line pt-4">
        <p className="text-[13px] leading-[1.5] font-medium text-text-dim">
          {t("locked")}
        </p>
        <Link
          href="/app/household"
          className="mt-1 inline-block text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
        >
          {t("lockedLink")}
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-start gap-1 border-t border-line pt-4">
        <Button variant="text" size="sm" loading={pending} onClick={open}>
          {t("open")}
        </Button>
        {/* What the detail contains belongs beside the button, not inside it:
            a label long enough to explain itself is a label too long to fit. */}
        <span className="text-[12px] font-medium text-gray">{t("openHint")}</span>
      </div>
    );
  }

  const macros = [
    { key: "fibre", value: detail.perServing.fibreG, unit: "g" },
    { key: "sugars", value: detail.perServing.sugarsG, unit: "g" },
    { key: "salt", value: detail.perServing.saltG, unit: "g" },
  ];

  return (
    <section
      data-testid="nutrition-detail"
      aria-label={t("title")}
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
        {t("title")}
      </h3>

      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {macros.map((macro) => (
          <div key={macro.key} className="flex items-baseline gap-1.5">
            <dt className="text-[12px] font-semibold text-text-dim">
              {t(`macros.${macro.key}`)}
            </dt>
            <dd className="tnum font-mono text-[15px] font-bold text-text">
              {macro.value}
              {macro.unit}
            </dd>
          </div>
        ))}
      </dl>

      {detail.micronutrients.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {detail.micronutrients.map((nutrient) => (
            <li key={nutrient.code} className="text-[12px] font-medium text-text-dim">
              {t(`nutrients.${nutrient.code}`)}{" "}
              <span className="tnum font-mono text-text">
                {nutrient.amount}
                {nutrient.unit === "ug" ? " µg" : ` ${nutrient.unit}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {detail.containsEstimates && (
        // A guessed ingredient contributes no vitamins at all, so the list is
        // short by however much it could not read. Saying so is the difference
        // between a measurement and a claim.
        <p data-testid="detail-estimated" className="text-[12px] font-medium text-coral-ink">
          {t("estimated")}
        </p>
      )}

      <p className="text-[11px] font-medium text-gray">{t("source")}</p>
    </section>
  );
}
