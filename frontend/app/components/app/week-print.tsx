"use client";

import { useLocale, useTranslations } from "next-intl";
import { SLOTS, formatDay, weekDays } from "@app/lib/week";
import type { Slot } from "@app/lib/week";
import type { PlannedMeal, WeekPlan } from "@app/lib/api";

/**
 * How many meals one cell prints before it stops listing them.
 *
 * A sheet that silently drops a dinner is a lie; one that says "+2" is a fact.
 * The cap is what makes "always one sheet" a promise rather than a hope: four
 * rows of at most four lines each is a known height, whatever somebody has
 * planned.
 */
const MOST_PER_CELL = 4;

/**
 * The week as a sheet for the fridge door.
 *
 * This is the only thing Fuelr prints that is read by several people at once,
 * and most of them have no account — which decides everything about it.
 *
 * Seven days across, four meals down, exactly the shape the screen takes at
 * `lg`. Landscape, because seven columns do not fit in portrait: the rule is
 * declared on this page and nowhere else, since the recipe and the shopping
 * list are read in the hand and belong in portrait.
 *
 * **What is deliberately not on it.** No photograph: it says nothing to
 * somebody walking past and costs a page of ink. No nutrition totals: they
 * address one person and would be read by the whole family. No colour that
 * carries meaning — a fridge sheet is read in black and white from a metre
 * away, so the only emphasis is weight and size.
 *
 * And **paper does not synchronise.** A meal moved after printing appears
 * nowhere on this sheet; the date across the top is what makes that obvious
 * rather than the sheet quietly claiming to be current.
 */
export function WeekPrint({ plan }: { plan: WeekPlan }) {
  const t = useTranslations("plan.printWeek");
  const tSlots = useTranslations("plan.slots");
  const tPlan = useTranslations("plan");
  const locale = useLocale();

  const days = weekDays(plan.weekStart);
  const untitled = tPlan("untitled");

  function mealsIn(date: string, slot: Slot): PlannedMeal[] {
    return plan.meals
      .filter((meal) => meal.date === date && meal.slot === slot)
      .sort((a, b) => a.position - b.position);
  }

  const cell = {
    border: "0.2mm solid #999",
    padding: "1.6mm 1.8mm",
    verticalAlign: "top" as const,
    // Seven equal columns of about 36 mm. A long title wraps onto a second
    // line; it never shrinks to something nobody can read at arm's length.
    width: "12.6%",
  };

  return (
    <>
      {/*
        Landscape, on this page only. `@page` cannot be scoped by selector, so
        it is scoped by route: this rule exists in the document only when the
        week sheet is what the document is. The margins are tighter than the
        global ones because seven columns need the width.
      */}
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm 8mm; } }`}</style>

      <h1
        style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: "18pt",
          fontWeight: 800,
          margin: 0,
        }}
      >
        {t("title")}
      </h1>
      {/* Read from a metre away, and the thing that says the sheet is a
          moment rather than a live view. */}
      <p style={{ margin: "1.5mm 0 0", fontSize: "12pt", fontWeight: 700 }}>
        {t("week", {
          from: formatDay(plan.weekStart, locale, { day: "numeric", month: "long" }),
          to: formatDay(days[6], locale, { day: "numeric", month: "long" }),
        })}
      </p>

      <table
        data-testid="print-week-grid"
        style={{
          width: "100%",
          marginTop: "4mm",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: "9pt",
        }}
      >
        <thead>
          <tr>
            {/* The corner. Empty on purpose: the row labels name themselves. */}
            <th style={{ ...cell, width: "10%", border: "none" }} />
            {days.map((date) => (
              <th key={date} style={{ ...cell, border: "none", paddingBottom: "1mm" }}>
                <span
                  style={{
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: "11pt",
                    fontWeight: 800,
                    textTransform: "capitalize",
                    display: "block",
                  }}
                >
                  {formatDay(date, locale, { weekday: "long" })}
                </span>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "8pt",
                    fontWeight: 400,
                    color: "#555",
                  }}
                >
                  {formatDay(date, locale, { day: "numeric", month: "numeric" })}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th
                scope="row"
                style={{
                  ...cell,
                  width: "10%",
                  border: "none",
                  textAlign: "left",
                  fontSize: "8pt",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {tSlots(slot)}
              </th>

              {days.map((date) => {
                const meals = mealsIn(date, slot);
                const shown = meals.slice(0, MOST_PER_CELL);
                const hidden = meals.length - shown.length;
                return (
                  <td
                    key={date}
                    data-testid={`print-cell-${date}-${slot}`}
                    // An empty slot stays an empty box. A missing row would
                    // read as "nothing is planned on Tuesdays".
                    style={{ ...cell, height: "26mm" }}
                  >
                    {shown.map((meal) => (
                      <div key={meal.id} style={{ marginBottom: "1.2mm" }}>
                        <span style={{ fontWeight: 700 }}>
                          {meal.title?.trim() || untitled}
                        </span>{" "}
                        <span
                          style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: "8pt",
                            color: "#555",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t("servings", { count: meal.servings })}
                        </span>
                      </div>
                    ))}
                    {/* Never a silent truncation. */}
                    {hidden > 0 && (
                      <div style={{ fontSize: "8pt", color: "#555" }}>
                        {t("more", { count: hidden })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {plan.meals.length === 0 && (
        <p style={{ marginTop: "6mm", fontSize: "10pt" }}>{t("empty")}</p>
      )}

      {/* Said once, at the bottom, because somebody will find this sheet in
          three weeks and take it for the current plan. */}
      <p style={{ marginTop: "5mm", fontSize: "8pt", color: "#555" }}>{t("moment")}</p>
    </>
  );
}
