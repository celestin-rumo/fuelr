"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDay } from "@app/lib/week";
import type { ShoppingListView } from "@app/lib/api";

/**
 * The list as a sheet of paper, to be ticked with a pen.
 *
 * Grouped by aisle in the order a shop is walked, like the screen — the whole
 * point of that order is the walk, and it does not change medium.
 *
 * The week is written at the top because a list without a date is a list found
 * in a bag three weeks later. And what is already in the cupboard sits apart at
 * the bottom rather than in the aisles: it is there to answer "do I need this?"
 * and not to be bought.
 *
 * Nothing ticked on paper comes back. The sheet does not pretend otherwise —
 * it is a copy taken at a moment, and the screen is still the list.
 */
export function ShoppingPrint({
  list,
  week,
}: {
  list: ShoppingListView;
  week: string;
}) {
  const t = useTranslations("shopping.print");
  const ts = useTranslations("shopping");
  const locale = useLocale();

  const empty = list.aisles.length === 0 && list.covered.length === 0;

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
        {t("title")}
      </h1>
      <p style={{ margin: "2mm 0 0", fontSize: "10pt", fontWeight: 600 }}>
        {t("week", {
          date: formatDay(week, locale, { day: "numeric", month: "long" }),
        })}
      </p>

      {empty && <p style={{ marginTop: "7mm" }}>{t("empty")}</p>}

      {list.aisles.map((group) => (
        <section key={group.aisle} style={{ marginTop: "6mm" }}>
          <h2
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: "11pt",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {ts(`aisles.${group.aisle}`)}
          </h2>
          <ul style={{ margin: "2mm 0 0", padding: 0, listStyle: "none" }}>
            {group.items.map((item) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "3mm",
                  padding: "1.4mm 0",
                  borderBottom: "0.2mm solid #ddd",
                }}
              >
                {/* A box to tick with a pen. Already ticked on screen prints
                    ticked: the paper is the same list, not a new one. */}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: "4mm",
                    height: "4mm",
                    border: "0.4mm solid #000",
                    borderRadius: "0.8mm",
                    textAlign: "center",
                    lineHeight: "3.4mm",
                    fontSize: "8pt",
                    flex: "0 0 auto",
                  }}
                >
                  {item.checked ? "✓" : ""}
                </span>
                <span
                  style={{
                    minWidth: "20mm",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.toBuy != null && item.toBuy > 0
                    ? `${item.toBuy} ${item.unit}`.trim()
                    : ""}
                </span>
                <span
                  style={
                    item.checked
                      ? { textDecoration: "line-through", color: "#555" }
                      : undefined
                  }
                >
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {list.covered.length > 0 && (
        <section style={{ marginTop: "8mm" }}>
          <h2 style={{ fontFamily: '"Poppins", sans-serif', fontSize: "11pt", margin: 0 }}>
            {t("covered")}
          </h2>
          <p style={{ margin: "2mm 0 0", fontSize: "10pt", color: "#555" }}>
            {list.covered.map((item) => item.name).join(" · ")}
          </p>
        </section>
      )}
    </>
  );
}
