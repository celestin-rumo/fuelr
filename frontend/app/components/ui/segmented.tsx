import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * One among few, chosen once.
 *
 * There were four of these — the pricing cycle, the three ways into the
 * editor, the onboarding answers and the library's all/favourites — and each
 * one drew "chosen" differently: a filled pill here, a tinted border there,
 * bare chips somewhere else. Homogeneity is the criterion that gets paid at
 * every screen somebody learns, so it is the one worth spending a component
 * on.
 *
 * A track with a filled cursor, because a 14% tint reads as "on" on a screen
 * you are looking straight at and as nothing on a worktop in daylight.
 *
 * It is not a tab list and does not claim to be: a tab list is navigation
 * between panels, and `role="group"` with `aria-pressed` says what this is —
 * a set of toggles of which one is on.
 */
export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** A count, a badge — anything that rides along with the label. */
  affix?: ReactNode;
  testId?: string;
  disabled?: boolean;
};

export type SegmentedProps<T extends string> = {
  /** Names the group for assistive tech. Required — a group of toggles with
   *  no name is a set of unrelated buttons. */
  label: string;
  options: SegmentedOption<T>[];
  /**
   * Undefined means nothing has been chosen yet, and no segment is on. It is
   * not the same as the first one being chosen, and must not look like it.
   */
  value: T | undefined;
  onChange: (value: T) => void;
  /**
   * Vertical, for options too long to sit side by side. Still one among few:
   * what changes is the room, not the question.
   */
  orientation?: "horizontal" | "vertical";
  className?: string;
  "data-testid"?: string;
};

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  orientation = "horizontal",
  className,
  "data-testid": testId,
}: SegmentedProps<T>) {
  const vertical = orientation === "vertical";

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn(
        "inline-flex gap-1 rounded-full border border-line bg-bg-raised-2 p-1",
        vertical ? "w-full flex-col rounded-lg" : "self-start",
        className,
      )}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            disabled={option.disabled}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            className={cn(
              // 36px where there is a pointer, 44px on a phone — the same
              // floor every other control in this application has.
              "inline-flex h-9 items-center justify-center gap-2 px-4 text-[13px] font-bold max-sm:h-11",
              vertical ? "rounded-md justify-start" : "rounded-full",
              "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
              // Branched in JS: two competing background utilities are
              // resolved by Tailwind's stylesheet order, not by the order
              // they are listed here.
              option.disabled
                ? "pointer-events-none text-gray opacity-50"
                : on
                  ? "bg-accent text-on-accent"
                  : "text-text-dim hover:text-text",
            )}
          >
            {option.label}
            {option.affix}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A count riding along with a segment's label.
 *
 * It inverts on the chosen segment, which is already the accent — otherwise
 * it disappears into it.
 */
export function SegmentedCount({ count, on }: { count: number; on: boolean }) {
  return (
    <span
      className={cn(
        "tnum rounded-full px-[7px] py-px text-[11px] font-bold",
        on ? "bg-on-accent text-accent" : "bg-accent text-on-accent",
      )}
    >
      {count}
    </span>
  );
}
