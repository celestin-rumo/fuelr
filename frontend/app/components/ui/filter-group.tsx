import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icons";

/**
 * A filter you open, in a row of them.
 *
 * The shape every shop's listing has — *Marque ▾*, *Prix ▾*, *Taille ▾* —
 * because it scales where a wall of chips does not: twenty-three options
 * become four labelled doors, and a door says on its face how many of its
 * options are on. The panel opens *beneath the row*, full width, rather
 * than floating over the page: a floating panel has to be positioned, kept
 * inside the viewport at 360px, and closed on a click anywhere else, and
 * every one of those is a place to be wrong. A panel in the flow is a
 * second row of chips, which the library has always known how to draw.
 *
 * On-state is the accent fill, like a chip, with the count inverted on it.
 */
export type FilterTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** How many of this filter's options are on. */
  count?: number;
  open?: boolean;
};

export function FilterTrigger({
  children,
  count = 0,
  open = false,
  className,
  type = "button",
  ...props
}: FilterTriggerProps) {
  const on = count > 0;
  return (
    <button
      type={type}
      aria-expanded={open}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-4 text-[13px] font-semibold",
        "transition-colors duration-[var(--dur-control)] ease-[var(--ease)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
        on
          ? "bg-accent text-on-accent"
          : "border border-line bg-bg-raised-2 text-text hover:border-gray",
        open && !on && "border-gray",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{children}</span>
        {on && (
          <span className="tnum rounded-full bg-on-accent px-1.5 font-mono text-[11px] leading-[18px] text-accent">
            {count}
          </span>
        )}
      </span>
      <Icon
        name="chevronDown"
        size={16}
        className={cn(
          "shrink-0 transition-transform duration-[var(--dur-fast)] ease-[var(--ease)]",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

/** The options of the one open filter, in the flow under the row. */
export function FilterPanel({
  id,
  labelledBy,
  children,
  className,
  ...props
}: {
  id: string;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelledBy}
      className={cn(
        "flex flex-wrap gap-2 rounded-md border border-line bg-bg-raised p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
