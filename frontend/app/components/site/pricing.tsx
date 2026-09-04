"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@ui/badge";
import { Banner } from "@ui/banner";
import type { PlanPrices } from "@app/lib/api";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@ui/button";
import { cn } from "@ui/cn";
import { Segmented } from "@ui/segmented";

type PlanLine = { ok: boolean; text: string };

type Plan = {
  /** Ties the copy to the tier the backend prices and grants. */
  tier: "FREE" | "PLUS" | "FAMILY";
  name: string;
  badge: string;
  perMonthly: string;
  perYearly: string;
  pitch: string;
  cta: string;
  featured?: boolean;
  lines: PlanLine[];
};

/**
 * A figure with as many decimals as it needs, in the reader's own convention:
 * 6,90 in French, 6.90 in English, and 69 rather than 69,00.
 */
function price(value: number, locale: string) {
  const decimals = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function PricingPlans({ prices }: { prices: PlanPrices | null }) {
  const t = useTranslations("site.pricing");
  const locale = useLocale();
  const plans = t.raw("plans") as Plan[];
  const [yearly, setYearly] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      {/* What the plans will cost, and what is true today. Crosses beside
          features that currently work would make this page a lie, so the
          banner says which of the two the reader is looking at. */}
      {prices?.openPeriod && (
        <Banner tone="info" title={t("launch.title")} data-testid="launch-banner">
          {t("launch.body")}
        </Banner>
      )}

      <Segmented
        label={t("label")}
        value={yearly ? "yearly" : "monthly"}
        onChange={(cycle) => setYearly(cycle === "yearly")}
        options={[
          { value: "monthly", label: t("cycles.monthly") },
          { value: "yearly", label: t("cycles.yearly") },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "flex flex-col rounded-lg border p-8",
              plan.featured
                ? "border-accent-ink bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-raised))]"
                : "border-line bg-bg-raised",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
                {plan.name}
              </h3>
              <Badge tone={plan.featured ? "solid" : "neutral"}>
                {plan.badge}
              </Badge>
            </div>

            {/* The figure comes from the backend, which is also what a
                checkout would charge. With no answer from it the card keeps
                everything else it has to say rather than showing a zero. */}
            {(() => {
              const priced = prices?.plans.find((one) => one.tier === plan.tier);
              if (!priced) return null;
              return (
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="tnum font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] text-text">
                    {price(yearly ? priced.yearly : priced.monthly, locale)}
                  </span>
                  <span className="text-[13px] font-semibold text-text-dim">
                    {yearly ? plan.perYearly : plan.perMonthly}
                  </span>
                </div>
              );
            })()}

            <p className="mt-3 text-[15px] leading-[1.5] font-medium text-text-dim">
              {plan.pitch}
            </p>

            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {plan.lines.map((line) => (
                <li
                  key={line.text}
                  className="flex items-start gap-2.5 text-[14px] font-medium"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 shrink-0 font-bold",
                      line.ok ? "text-accent-ink" : "text-gray",
                    )}
                  >
                    {line.ok ? "✓" : "—"}
                  </span>
                  <span className={line.ok ? "text-text" : "text-gray"}>
                    {line.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* Every plan leads to sign-up: there is no billing yet, so
                picking one cannot mean more than creating an account. */}
            <Link
              href="/register"
              className={buttonClasses({
                className: "mt-8",
                fullWidth: true,
                variant: plan.featured ? "primary" : "secondary",
              })}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
