import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * A line in a list, written once.
 *
 * The shopping list, the journal, the household members and the suggestions
 * each drew their own version of the same thing, and none of them drew an
 * object: a line separated by a rule has no visible target, so on a phone you
 * aim at a gap between two hairlines. Here the line *is* the surface.
 *
 * Three slots and nothing else — something before, the text, something after
 * — because a row that takes arbitrary layout is not a pattern, it is a `div`
 * with a longer name.
 */
export type ListRowProps = HTMLAttributes<HTMLElement> & {
  /** `li` when the row is its own list item, `div` inside one. */
  as?: ElementType;
  /** A thumbnail, a checkbox, a rank. Never a control the row also links to. */
  leading?: ReactNode;
  /** A value, a badge, a rail of actions. */
  trailing?: ReactNode;
  /** Carries the accent border — pinned, chosen, today. */
  selected?: boolean;
  /** Lifts on hover. Only for a row that goes somewhere. */
  interactive?: boolean;
  children: ReactNode;
};

export function ListRow({
  as: Tag = "div",
  leading,
  trailing,
  selected = false,
  interactive = false,
  className,
  children,
  ...props
}: ListRowProps) {
  return (
    <Tag
      className={cn(
        // `relative` so a caller can stretch a link across the whole row.
        "relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-bg-raised px-4 py-3",
        selected ? "border-accent-ink" : "border-line",
        interactive &&
          "transition-[border-color,background-color] duration-[var(--dur-fast)] ease-[var(--ease)] hover:border-gray hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]",
        className,
      )}
      {...props}
    >
      {leading}
      {/*
       * `min-w-0` lets a long title wrap instead of pushing the trailing slot
       * off the screen; the 10rem basis is what makes the row wrap at all. A
       * `flex-1` middle has a zero basis, so it shrinks to nothing and a rail
       * of five 44px controls stays on the first line at 360px, squeezing the
       * title into about 20 pixels rather than dropping below it.
       */}
      <div className="min-w-0 grow basis-40">{children}</div>
      {trailing}
    </Tag>
  );
}

/** The row's first line: the thing itself. */
export function ListRowTitle({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "font-display text-[15px] font-bold tracking-[-0.01em] text-text",
        className,
      )}
      {...props}
    />
  );
}

/** Its second: what somebody needs to tell it apart from the row below. */
export function ListRowMeta({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-0.5 text-[13px] font-medium text-text-dim", className)}
      {...props}
    />
  );
}

/**
 * A rail of icon controls at the end of a row.
 *
 * Fixed by construction: it is a grid of equal columns, so a control that does
 * not apply is disabled in place rather than removed. Two neighbouring rows
 * with different actions used to put "delete" in different places, and the one
 * you land on when you miss is the one that cannot be undone.
 */
export function ListRowActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // `ml-auto` keeps the rail at the end of the row, and at the end of its
      // own line once the row has wrapped on a phone.
      className={cn("ml-auto flex shrink-0 items-center gap-0.5", className)}
      {...props}
    />
  );
}
