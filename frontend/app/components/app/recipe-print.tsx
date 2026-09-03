"use client";

import { useTranslations } from "next-intl";

export type PrintableRecipe = {
  title: string | null;
  description: string | null;
  servings: number;
  totalMinutes: number | null;
  sourceUrl: string | null;
  unverified: string[];
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    /** Absent on a line somebody typed: only an import marks one. */
    needsReview?: boolean;
  }[];
  steps: string[];
};

/**
 * A recipe as a sheet of paper.
 *
 * What is on it is what somebody standing at a worktop needs: the title, how
 * many it feeds, how long it takes, the quantities, and the method. What is
 * not on it is everything that only works on a screen — the tabs, the
 * autosave, the nutrition panel, the photo.
 *
 * The quantities are the ones showing on screen, servings included: printing a
 * recipe scaled to six must not hand back the one written for four.
 *
 * A line the import could not read keeps its mark on paper. A guess that
 * became a fact by changing medium would be the same lie in a new place.
 */
export function RecipePrint({ recipe }: { recipe: PrintableRecipe }) {
  const t = useTranslations("recipe.print");
  const tr = useTranslations("recipe");

  const title = recipe.title?.trim() || tr("untitled");
  const meta = [
    t("servings", { count: recipe.servings }),
    recipe.totalMinutes ? t("minutes", { count: recipe.totalMinutes }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
        {title}
      </h1>
      <p style={{ margin: "2mm 0 0", fontSize: "10pt", fontWeight: 600 }}>{meta}</p>

      {recipe.description && (
        <p style={{ margin: "3mm 0 0", fontSize: "10.5pt" }}>{recipe.description}</p>
      )}

      {recipe.unverified.length > 0 && (
        // Written out rather than shown as a symbol: nobody has a legend in
        // their hand while they cook.
        <p style={{ margin: "3mm 0 0", fontSize: "9.5pt", fontStyle: "italic" }}>
          {t("unverified", {
            fields: recipe.unverified.map((field) => tr(`review.fields.${field}`)).join(", "),
          })}
        </p>
      )}

      <section style={{ marginTop: "7mm" }}>
        <h2 style={{ fontFamily: '"Poppins", sans-serif', fontSize: "12pt", margin: 0 }}>
          {t("ingredients")}
        </h2>
        <ul style={{ margin: "3mm 0 0", padding: 0, listStyle: "none" }}>
          {recipe.ingredients.map((line, index) => (
            <li
              key={`${line.name}-${index}`}
              style={{
                display: "flex",
                gap: "4mm",
                padding: "1.2mm 0",
                borderBottom: "0.2mm solid #ddd",
              }}
            >
              <span
                style={{
                  minWidth: "24mm",
                  fontFamily: '"JetBrains Mono", monospace',
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {line.quantity > 0 ? `${line.quantity} ${line.unit}`.trim() : ""}
              </span>
              <span>
                {line.name}
                {line.needsReview && (
                  <span style={{ fontStyle: "italic" }}> — {t("toCheck")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "7mm" }}>
        <h2 style={{ fontFamily: '"Poppins", sans-serif', fontSize: "12pt", margin: 0 }}>
          {t("steps")}
        </h2>
        <ol style={{ margin: "3mm 0 0", paddingLeft: "6mm" }}>
          {recipe.steps.map((step, index) => (
            <li key={index} style={{ padding: "1.5mm 0" }}>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {recipe.sourceUrl && (
        <p style={{ marginTop: "7mm", fontSize: "8.5pt", color: "#444" }}>
          {t("source", { url: recipe.sourceUrl })}
        </p>
      )}
    </>
  );
}
