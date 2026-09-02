"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDay } from "@app/lib/week";
import type { LogDay } from "@app/lib/api";

/**
 * One measure, one day per bar, with the target drawn across it.
 *
 * Deliberately one series per chart. Protein, carbohydrate and fat in a single
 * three-colour chart would need three hues that stay apart for a colourblind
 * reader, and this palette has exactly two chromatic families — lime and mint
 * are neighbours. The honest fix for that is not a worse palette, it is fewer
 * series per chart: three small charts side by side, each in the one accent,
 * each with its own target. Nothing then depends on telling two colours apart.
 *
 * A day nobody wrote down is drawn as an empty slot, not a zero bar. They are
 * different facts, and a zero would quietly flatter every average on screen.
 */
export function DayBars({
  days,
  value,
  target,
  label,
  unit,
  compact = false,
}: {
  days: LogDay[];
  /** Which figure of the day this chart draws. */
  value: (day: LogDay) => number;
  /** Drawn as a dashed rule when there is one. */
  target: number | null;
  label: string;
  unit: string;
  compact?: boolean;
}) {
  const t = useTranslations("journal");
  const locale = useLocale();

  const values = days.map((day) => (day.logged ? value(day) : null));
  const highest = Math.max(
    target ?? 0,
    ...values.map((value) => value ?? 0),
    1,
  );
  // A wide viewBox rather than a narrow one stretched to fit: with
  // `preserveAspectRatio="none"` and a 100-unit box, one horizontal unit
  // becomes eight pixels and every rounded corner turns into an ellipse.
  const height = compact ? 80 : 140;
  const width = 700;
  const slot = width / days.length;
  // Thin marks: the bar is the data, the gap is what makes it readable.
  const barWidth = slot * 0.62;

  const scale = (value: number) => (value / (highest * 1.1)) * height;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {label}
        </span>
        {target != null && (
          <span className="tnum font-mono text-[11px] text-gray">
            {t("target", { value: target, unit })}
          </span>
        )}
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height + 12}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t("chartSummary", {
          label,
          days: days.filter((day) => day.logged).length,
          total: days.length,
        })}
        className={compact ? "h-20 w-full" : "h-36 w-full"}
      >
        {/* Recessive: the data is the subject, the frame is not. */}
        <line
          x1="0"
          y1={height}
          x2={width}
          y2={height}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {target != null && target > 0 && (
          <line
            x1="0"
            y1={height - scale(target)}
            x2={width}
            y2={height - scale(target)}
            stroke="var(--gray)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {days.map((day, index) => {
          const measured = values[index];
          const x = index * slot + (slot - barWidth) / 2;
          if (measured == null) {
            // Nothing written down: a tick on the baseline, so the day is
            // present and visibly empty rather than absent or zero.
            return (
              <line
                key={day.date ?? index}
                x1={x + barWidth / 2}
                y1={height}
                x2={x + barWidth / 2}
                y2={height - 3}
                stroke="var(--line)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          const barHeight = Math.max(scale(measured), 1);
          return (
            <rect
              key={day.date ?? index}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill="var(--lime-ink)"
              data-testid={`bar-${day.date}`}
            >
              <title>
                {day.date
                  ? `${formatDay(day.date, locale, { weekday: "long", day: "numeric" })} · ${measured} ${unit}`
                  : `${measured} ${unit}`}
              </title>
            </rect>
          );
        })}
      </svg>

      {!compact && (
        <div className="flex" aria-hidden>
          {days.map((day, index) => (
            <span
              key={day.date ?? index}
              className="flex-1 text-center text-[11px] font-semibold text-gray"
            >
              {day.date ? formatDay(day.date, locale, { weekday: "narrow" }) : ""}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
