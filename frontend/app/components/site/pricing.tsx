"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@ui/badge";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@ui/button";
import { cn } from "@ui/cn";

type PlanLine = { ok: boolean; text: string };

type Plan = {
  name: string;
  badge: string;
  priceMonthly: string;
  priceYearly: string;
  perMonthly: string;
  perYearly: string;
  pitch: string;
  cta: string;
  featured?: boolean;
  lines: PlanLine[];
};

export function PricingPlans() {
  const t = useTranslations("site.pricing");
  const plans = t.raw("plans") as Plan[];
  const [yearly, setYearly] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div
        role="group"
        aria-label={t("label")}
        className="inline-flex self-start rounded-full border border-line bg-bg-raised-2 p-1"
      >
        {[
          { key: "monthly", label: t("cycles.monthly"), on: !yearly },
          { key: "yearly", label: t("cycles.yearly"), on: yearly },
        ].map((cycle) => (
          <button
            key={cycle.key}
            type="button"
            aria-pressed={cycle.on}
            onClick={() => setYearly(cycle.key === "yearly")}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-bold transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
              cycle.on
                ? "bg-accent text-on-accent"
                : "text-text-dim hover:text-text",
            )}
          >
            {cycle.label}
          </button>
        ))}
      </div>

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

            <div className="mt-5 flex items-baseline gap-2">
              <span className="tnum font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] text-text">
                {yearly ? plan.priceYearly : plan.priceMonthly}
              </span>
              <span className="text-[13px] font-semibold text-text-dim">
                {yearly ? plan.perYearly : plan.perMonthly}
              </span>
            </div>

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
