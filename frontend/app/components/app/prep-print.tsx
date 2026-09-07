"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDay } from "@app/lib/week";
import type { PrepSession } from "@app/lib/api";

/**
 * The session as a sheet of paper.
 *
 * The one screen in this application more likely to be printed than read: two
 * hours of cooking happen with wet hands and a phone that has gone dark, and
 * the whole afternoon has to be visible at once rather than scrolled.
 *
 * Same order as the screen, because it is the order the afternoon runs in: the
 * shared bases first, with a box to tick as each one is made, then each dish
 * longest first with only what is left to do.
 *
 * And the same silence about keeping: no published figure sits behind a shelf
 * life, and a made-up one is a health risk rather than an approximation.
 */
export function PrepPrint({ session }: { session: PrepSession }) {
  const t = useTranslations("plan.prep");
  const tSlots = useTranslations("plan.slots");
  const locale = useLocale();

  const heading = {
    fontFamily: '"Poppins", sans-serif',
    fontSize: "11pt",
    margin: 0,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  };

  const box = {
    display: "inline-block",
    width: "4mm",
    height: "4mm",
    border: "0.4mm solid #000",
    borderRadius: "0.8mm",
    flex: "0 0 auto",
  };

  return (
    <>
      <h1
        style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: "20pt",
          fontWeight: 800,
          margin: 0,
        }}
      >
        {t("print.title")}
      </h1>
      <p style={{ margin: "2mm 0 0", fontSize: "10pt", fontWeight: 600 }}>
        {t("print.week", {
          date: formatDay(session.weekStart, locale, { day: "numeric", month: "long" }),
        })}
      </p>

      {session.dishes.length === 0 && (
        <p style={{ marginTop: "7mm" }}>{t("print.empty")}</p>
      )}

      {session.bases.length > 0 && (
        <section style={{ marginTop: "6mm" }}>
          <h2 style={heading}>{t("bases.title")}</h2>
          <ul style={{ margin: "2mm 0 0", padding: 0, listStyle: "none" }}>
            {session.bases.map((base) => (
              <li
                key={`${base.name}-${base.unit}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "3mm",
                  padding: "1.6mm 0",
                  borderBottom: "0.2mm solid #ddd",
                }}
              >
                {/* Ticked with a pen as each base comes off the stove. */}
                <span aria-hidden style={box} />
                <span
                  style={{
                    minWidth: "22mm",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {`${base.quantity} ${base.unit}`.trim()}
                </span>
                <span>
                  <strong>{base.name}</strong>
                  <span style={{ color: "#555" }}>
                    {" — "}
                    {base.dishes.join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {session.dishes.length > 0 && (
        <section style={{ marginTop: "8mm" }}>
          <h2 style={heading}>{t("dishes.title")}</h2>
          {session.dishes.map((dish, at) => (
            <article
              key={dish.mealId}
              style={{
                marginTop: "5mm",
                // A dish split across two sheets is a dish somebody misses the
                // second half of.
                breakInside: "avoid",
              }}
            >
              <h3
                style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: "12pt",
                  margin: 0,
                }}
              >
                {at + 1}. {dish.title}
              </h3>
              <p style={{ margin: "1mm 0 0", fontSize: "9pt", color: "#555" }}>
                {t("dishes.meta", {
                  day: formatDay(dish.date, locale, { weekday: "long" }),
                  slot: tSlots(dish.slot),
                  minutes: dish.minutes,
                  servings: dish.servings,
                })}
              </p>

              {dish.rest.length > 0 && (
                <p
                  style={{
                    margin: "2mm 0 0",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "9pt",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {dish.rest
                    .map((line) => `${line.quantity} ${line.unit} ${line.name}`.trim())
                    .join(" · ")}
                </p>
              )}

              {dish.steps.length > 0 && (
                <ol style={{ margin: "2mm 0 0", paddingLeft: "6mm", fontSize: "10pt" }}>
                  {dish.steps.map((step, index) => (
                    <li key={index} style={{ padding: "0.6mm 0" }}>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </section>
      )}

      <p style={{ marginTop: "8mm", fontSize: "9pt", color: "#555" }}>{t("keeping")}</p>
    </>
  );
}
