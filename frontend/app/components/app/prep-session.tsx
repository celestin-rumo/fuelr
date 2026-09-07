"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@ui/button";
import { Card } from "@ui/card";
import { EmptyState } from "@ui/empty-state";
import { Icon } from "@ui/icons";
import { SectionHead } from "@ui/section-head";
import { formatDay } from "@app/lib/week";
import type { PrepSession } from "@app/lib/api";

/**
 * A week already on the plan, read as one afternoon's work.
 *
 * Two sections, in the order the afternoon runs. The **shared bases** first —
 * what gets peeled, roasted or cooked once for several dishes, with the total
 * to actually make. Then each dish, longest first, with only what is left to
 * do once the bases are made: repeating an ingredient already prepared is how
 * a work plan turns back into six recipes side by side.
 *
 * **It says nothing about how long anything keeps.** No published figure sits
 * behind that, and a made-up shelf life is a health risk rather than an
 * approximation — so the sheet says out loud that it does not know, and the
 * decision stays with the person who can smell the fridge.
 *
 * And it is not cooking mode. That follows one recipe, one step at a time,
 * with dirty hands. This is read before starting, and printed.
 */
export function PrepSessionView({
  session,
  week,
}: {
  session: PrepSession;
  week: string;
}) {
  const t = useTranslations("plan.prep");
  const tSlots = useTranslations("plan.slots");
  const locale = useLocale();

  if (session.dishes.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="calendar" size={24} />}
        title={t("empty.title")}
        body={t("empty.body")}
        action={
          <Link
            href={{ pathname: "/app/plan", query: { week } }}
            className={buttonClasses()}
          >
            {t("empty.action")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHead as="h2" hint={t("bases.hint")}>
          {t("bases.title")}
        </SectionHead>

        {/* No shared base is a real answer about a varied week, not a failure
            of the screen — and saying so beats an empty box. */}
        {session.bases.length === 0 ? (
          <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("bases.none")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="prep-bases">
            {session.bases.map((base) => (
              <li
                key={`${base.name}-${base.unit}`}
                className="flex flex-col gap-1 rounded-md border border-line bg-bg-raised p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[16px] font-bold text-text">
                    {base.name}
                  </span>
                  <span className="tnum font-mono text-[13px] text-accent-ink">
                    {t("bases.quantity", {
                      quantity: base.quantity,
                      unit: base.unit,
                    })}
                  </span>
                </div>
                <span className="text-[13px] font-semibold text-text-dim">
                  {t("bases.forDishes", { dishes: base.dishes.join(" · ") })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead as="h2" hint={t("dishes.hint")}>
          {t("dishes.title")}
        </SectionHead>

        <ol className="flex flex-col gap-3" data-testid="prep-dishes">
          {session.dishes.map((dish, at) => (
            <li key={dish.mealId}>
              <Card as="card" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-display text-[16px] font-bold text-text">
                    <span className="tnum mr-2 font-mono text-[13px] text-gray">
                      {at + 1}.
                    </span>
                    {dish.title}
                  </h3>
                  <span className="tnum font-mono text-[11px] text-gray">
                    {t("dishes.meta", {
                      day: formatDay(dish.date, locale, { weekday: "long" }),
                      slot: tSlots(dish.slot),
                      minutes: dish.minutes,
                      servings: dish.servings,
                    })}
                  </span>
                </div>

                {/* What is left after the bases. An empty list is the best
                    possible answer: everything this dish needs is already made. */}
                {dish.rest.length === 0 ? (
                  <p className="text-[13px] font-semibold text-mint-ink">
                    {t("dishes.allShared")}
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {dish.rest.map((line, index) => (
                      <li
                        key={`${line.name}-${index}`}
                        className="tnum rounded-full bg-bg-raised-2 px-3 py-1 font-mono text-[11px] text-text-dim"
                      >
                        {t("dishes.line", {
                          name: line.name,
                          quantity: line.quantity,
                          unit: line.unit,
                        })}
                      </li>
                    ))}
                  </ul>
                )}

                {dish.steps.length > 0 && (
                  <ol className="flex list-decimal flex-col gap-1 pl-5 text-[15px] leading-[1.5] font-medium text-text-dim">
                    {dish.steps.map((step, index) => (
                      <li key={index} className="max-w-[68ch]">
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* The one health claim this application refuses to make. */}
      <p
        data-testid="prep-keeping"
        className="max-w-[68ch] text-[13px] leading-[1.5] font-semibold text-text-dim"
      >
        {t("keeping")}
      </p>
    </div>
  );
}
