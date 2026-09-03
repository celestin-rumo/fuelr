import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

// 36px where there is a pointer, 44px on a phone. Which of the two heights
// wins is Tailwind's stylesheet order rather than the order they are written
// here, so the rendered box is measured at 360px in `e2e/mobile-360.spec.ts`.
function shellClasses(active: boolean, disabled?: boolean) {
  return cn(
    "inline-flex h-9 max-sm:h-11 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold",
    "transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]",
    disabled
      ? "border-transparent bg-bg-raised-2 text-gray"
      : active
        ? "border-accent-ink bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent-ink"
        : "border-line text-text-dim hover:border-gray hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-text",
  );
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]";

function Count({ count }: { count: number }) {
  return (
    <span className="tnum rounded-full bg-accent px-[7px] py-px text-[11px] font-bold text-on-accent">
      {count}
    </span>
  );
}

export type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
  active?: boolean;
  /** Adds a separate remove control. The chip stays independently clickable. */
  onRemove?: () => void;
  removeLabel?: string;
  /** Renders a count affix on the accent fill. */
  count?: number;
};

export function Chip({
  children,
  active = false,
  onRemove,
  removeLabel = "Remove",
  count,
  className,
  type = "button",
  disabled,
  ...props
}: ChipProps) {
  // A removable chip is two controls, so the shell can't be the button
  // itself — an interactive element may not nest inside another.
  if (onRemove) {
    return (
      <span className={cn(shellClasses(active, disabled), "pr-2", className)}>
        <button
          type={type}
          disabled={disabled}
          aria-pressed={active}
          className={cn("inline-flex items-center gap-2 rounded-full", focusRing)}
          {...props}
        >
          {children}
          {typeof count === "number" && <Count count={count} />}
        </button>
        <button
          type="button"
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
          className={cn(
            "rounded-full px-1 leading-none opacity-70 hover:opacity-100",
            focusRing,
          )}
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        shellClasses(active, disabled),
        focusRing,
        "active:scale-[0.97] disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
      {typeof count === "number" && <Count count={count} />}
    </button>
  );
}
