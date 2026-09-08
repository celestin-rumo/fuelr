"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FoodIcon } from "@ui/food-icons";
import { cn } from "@ui/cn";
import { iconsFor } from "@app/lib/food-words";
import type { Progress } from "@app/lib/ideas-stream";

/** How long each food stays before the next takes its place. */
const TURN_MS = 1100;

/**
 * The wait while a model writes dishes, shown as what it is working from.
 *
 * A spinner over two minutes reads as a hang. This turns the foods somebody
 * typed — or, once dishes start arriving, the foods in their titles — one
 * after the other, and under them a bar that counts the dishes as their
 * titles close: *plat 6 sur 14 · Dahl de lentilles*. The count is real; it
 * comes from the stream, never from a clock. Before the first dish there is
 * nothing to count, and the bar says so by pulsing rather than by inventing
 * a percentage.
 *
 * One live region, polite, so a screen reader hears the count move without
 * being interrupted by every turn of the picture.
 */
export function WorkingOn({
  label,
  words,
  progress,
  className,
  ...rest
}: {
  /** What is happening, in a sentence: "On écrit les plats de la semaine…". */
  label: string;
  /** What was typed, if anything. Decides the pictures. */
  words?: string;
  /** The last thing the stream said, or null before it said anything. */
  progress: Progress | null;
  className?: string;
  "data-testid"?: string;
}) {
  const t = useTranslations("working");
  const icons = useMemo(
    () => iconsFor([words ?? "", progress?.title ?? ""].join(" ")),
    [words, progress?.title],
  );
  // A running count rather than an index reset on every change of pictures:
  // resetting inside the effect is a render inside a render, and the modulo
  // below makes the count land on a picture whatever the list's length.
  const [turns, setTurns] = useState(0);
  const at = turns % icons.length;

  useEffect(() => {
    if (icons.length < 2) return;
    const turn = window.setInterval(() => setTurns((current) => current + 1), TURN_MS);
    return () => window.clearInterval(turn);
  }, [icons]);

  const of = progress?.of ?? 0;
  const done = progress?.done ?? 0;
  const percent = of > 0 ? Math.min(100, Math.round((done / of) * 100)) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center gap-4 rounded-md border border-line bg-bg-raised-2 p-6 text-center",
        className,
      )}
      {...rest}
    >
      <div className="relative size-16" aria-hidden="true">
        {icons.map((name, index) => (
          <span
            key={name}
            data-turn={index === at ? "on" : undefined}
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-bg-raised text-mint-ink transition-[opacity,transform] duration-[var(--dur)] ease-[var(--ease)]",
              index === at ? "scale-100 opacity-100" : "scale-90 opacity-0",
            )}
          >
            <FoodIcon name={name} size={34} />
          </span>
        ))}
      </div>

      <p className="font-display text-[16px] leading-[1.2] font-bold text-text">{label}</p>

      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={of > 0 ? of : undefined}
        aria-valuenow={of > 0 ? done : undefined}
        aria-valuetext={of > 0 ? t("dish", { done, of }) : t("starting")}
        className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-bg-raised"
      >
        <div
          className={cn(
            "h-full rounded-full bg-mint transition-[width] duration-[var(--dur)] ease-[var(--ease)]",
            of === 0 && "w-1/3 animate-pulse",
          )}
          style={of > 0 ? { width: `${percent}%` } : undefined}
        />
      </div>

      <p className="tnum text-[13px] font-semibold text-text-dim">
        {of > 0 ? (
          <>
            {t("dish", { done, of })}
            {progress?.title && (
              <>
                {" · "}
                <span className="text-text" data-testid="working-title">
                  {progress.title}
                </span>
              </>
            )}
          </>
        ) : (
          t("starting")
        )}
      </p>
    </div>
  );
}
